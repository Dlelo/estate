package com.example.estate.service;

import com.example.estate.dto.MpesaStkCallbackRequest;
import com.example.estate.dto.StkPushResponse;
import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.*;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.estate.dto.BulkPaymentRequest;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    /** Safaricom's ResultCode for "request cancelled by user". */
    private static final int RESULT_CODE_CANCELLED = 1032;

    private final PaymentRepository paymentRepository;
    private final ContributionRepository contributionRepository;
    private final DarajaClient darajaClient;
    private final NotificationService notificationService;

    /** Manual/synchronous payment recording — non-MPESA methods only (bank, credit card). */
    public Payment makePayment(
            Long contributionId,
            BigDecimal amount,
            PaymentMethod method,
            String reference
    ) {
        if (method == PaymentMethod.MPESA) {
            throw new IllegalArgumentException(
                    "MPESA payments must go through the STK push flow (/stk-push), not this endpoint");
        }

        Contribution contribution = contributionRepository.findById(contributionId)
                .orElseThrow(() -> new RuntimeException("Contribution not found"));

        if (contribution.getBalance().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Contribution already settled");
        }

        if (amount.compareTo(contribution.getBalance()) > 0) {
            throw new RuntimeException("Payment exceeds balance");
        }

        Payment payment = Payment.builder()
                .user(contribution.getUser())
                .contribution(contribution)
                .amount(amount)
                .method(method)
                .transactionReference(reference)
                .status(PaymentStatus.COMPLETED)
                .build();

        paymentRepository.save(payment);
        applyPaymentToContribution(contribution, amount);

        return payment;
    }

    /** Atomic: if any contribution in the batch is invalid, the whole batch rolls back rather than
     *  partially applying (this method runs inside one transaction). */
    @Transactional
    public List<Payment> bulkPay(BulkPaymentRequest req) {
        List<Contribution> contributions = req.getIds().stream()
                .map(id -> contributionRepository.findById(id)
                        .orElseThrow(() -> new RuntimeException("Contribution not found: " + id)))
                .filter(c -> !Boolean.TRUE.equals(c.getSettled()))
                .toList();

        return contributions.stream()
                .map(c -> makePayment(c.getId(), c.getBalance(), req.getMethod(), req.getReference()))
                .toList();
    }

    /** Initiates an STK push for a single contribution's outstanding balance. */
    public StkPushResponse initiateStkPush(Long contributionId, String phoneNumber) {
        Contribution contribution = contributionRepository.findById(contributionId)
                .orElseThrow(() -> new RuntimeException("Contribution not found"));

        if (Boolean.TRUE.equals(contribution.getSettled())) {
            throw new IllegalStateException("Contribution already settled");
        }

        BigDecimal amount = contribution.getBalance();
        DarajaClient.StkPushResult result = darajaClient.initiateStkPush(
                normalizePhoneNumber(phoneNumber),
                amount.longValueExact(),
                "CONTRIB-" + contribution.getId(),
                contribution.getContributionType().getName() + " - " + contribution.getPeriod()
        );

        Payment payment = Payment.builder()
                .user(contribution.getUser())
                .contribution(contribution)
                .amount(amount)
                .method(PaymentMethod.MPESA)
                .status(PaymentStatus.PENDING)
                .merchantRequestId(result.getMerchantRequestId())
                .checkoutRequestId(result.getCheckoutRequestId())
                .build();
        paymentRepository.save(payment);

        return new StkPushResponse(result.getCheckoutRequestId(), result.getMerchantRequestId(), result.getCustomerMessage());
    }

    /** Initiates one STK push covering several contributions' combined balance for the same user. */
    public StkPushResponse initiateBulkStkPush(List<Long> contributionIds, String phoneNumber) {
        List<Contribution> contributions = contributionIds.stream()
                .map(id -> contributionRepository.findById(id)
                        .orElseThrow(() -> new RuntimeException("Contribution not found: " + id)))
                .filter(c -> !Boolean.TRUE.equals(c.getSettled()))
                .toList();

        if (contributions.isEmpty()) {
            throw new IllegalStateException("No outstanding contributions selected");
        }

        User user = contributions.getFirst().getUser();
        boolean sameUser = contributions.stream().allMatch(c -> c.getUser().getId().equals(user.getId()));
        if (!sameUser) {
            throw new IllegalArgumentException("All selected contributions must belong to the same member");
        }

        BigDecimal totalAmount = contributions.stream()
                .map(Contribution::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        DarajaClient.StkPushResult result = darajaClient.initiateStkPush(
                normalizePhoneNumber(phoneNumber),
                totalAmount.longValueExact(),
                "BULK-" + user.getId(),
                "Bulk contribution payment (" + contributions.size() + " item(s))"
        );

        for (Contribution contribution : contributions) {
            paymentRepository.save(Payment.builder()
                    .user(contribution.getUser())
                    .contribution(contribution)
                    .amount(contribution.getBalance())
                    .method(PaymentMethod.MPESA)
                    .status(PaymentStatus.PENDING)
                    .merchantRequestId(result.getMerchantRequestId())
                    .checkoutRequestId(result.getCheckoutRequestId())
                    .build());
        }

        return new StkPushResponse(result.getCheckoutRequestId(), result.getMerchantRequestId(), result.getCustomerMessage());
    }

    public PaymentStatus getStatusByCheckoutRequestId(String checkoutRequestId) {
        List<Payment> payments = paymentRepository.findAllByCheckoutRequestId(checkoutRequestId);
        if (payments.isEmpty()) {
            throw new RuntimeException("No payment found for checkout request: " + checkoutRequestId);
        }
        // All payments sharing a checkoutRequestId (bulk STK push) are transitioned together
        // in handleStkCallback/reconcilePendingPayment, so they always share one status.
        return payments.getFirst().getStatus();
    }

    /**
     * Processes a Daraja STK callback. Idempotent: a checkoutRequestId already resolved
     * (non-PENDING) is logged and skipped, so Safaricom's own callback retries are safe.
     * Row-locks the payment(s) first so two callback deliveries arriving concurrently for
     * the same checkoutRequestId can't both observe PENDING and double-apply the payment.
     */
    @Transactional
    public void handleStkCallback(MpesaStkCallbackRequest request, String rawBody) {
        MpesaStkCallbackRequest.StkCallback callback = request.body().stkCallback();
        String checkoutRequestId = callback.checkoutRequestId();

        List<Payment> payments = paymentRepository.findAllByCheckoutRequestIdForUpdate(checkoutRequestId);
        if (payments.isEmpty()) {
            log.warn("Received M-Pesa callback for unknown checkoutRequestId={}", checkoutRequestId);
            return;
        }

        boolean alreadyProcessed = payments.stream().anyMatch(p -> p.getStatus() != PaymentStatus.PENDING);
        if (alreadyProcessed) {
            log.info("Duplicate M-Pesa callback for checkoutRequestId={} — ignoring", checkoutRequestId);
            return;
        }

        if (callback.resultCode() == 0) {
            String receiptNumber = extractMpesaReceiptNumber(callback);
            for (Payment payment : payments) {
                payment.setStatus(PaymentStatus.COMPLETED);
                payment.setTransactionReference(receiptNumber);
                payment.setRawCallback(rawBody);
                paymentRepository.save(payment);
                applyPaymentToContribution(payment.getContribution(), payment.getAmount());
                notificationService.notifyPaymentReceived(payment);
            }
        } else {
            PaymentStatus status = callback.resultCode() == RESULT_CODE_CANCELLED
                    ? PaymentStatus.CANCELLED
                    : PaymentStatus.FAILED;
            for (Payment payment : payments) {
                payment.setStatus(status);
                payment.setResultDesc(callback.resultDesc());
                payment.setRawCallback(rawBody);
                paymentRepository.save(payment);
                notificationService.notifyPaymentFailed(payment, status);
            }
            log.warn("M-Pesa payment {} for checkoutRequestId={}: {}", status, checkoutRequestId, callback.resultDesc());
        }
    }

    /**
     * Reconciles a Payment that has sat PENDING long enough that Safaricom's callback should
     * already have arrived. Queries Daraja's STK query endpoint for a definitive result; if
     * Safaricom has none yet and the payment has aged past {@code timeoutAfter}, marks it TIMEOUT
     * rather than leaving it PENDING forever.
     */
    @Transactional
    public void reconcilePendingPayment(String checkoutRequestId, java.time.Duration timeoutAfter) {
        List<Payment> payments = paymentRepository.findAllByCheckoutRequestIdForUpdate(checkoutRequestId);
        boolean stillPending = !payments.isEmpty() && payments.stream().allMatch(p -> p.getStatus() == PaymentStatus.PENDING);
        if (!stillPending) {
            return; // resolved by a real callback (or reconciled already) since this payment was queued for review
        }
        LocalDateTime createdAt = payments.getFirst().getCreatedAt();

        DarajaClient.StkQueryResult result;
        try {
            result = darajaClient.queryStkPushStatus(checkoutRequestId);
        } catch (Exception e) {
            log.warn("STK query failed for checkoutRequestId={}: {}", checkoutRequestId, e.getMessage());
            result = new DarajaClient.StkQueryResult(null, e.getMessage());
        }

        if (result.getResultCode() != null && result.getResultCode() == 0) {
            // Safaricom confirms success but our callback never landed — apply now without a receipt number.
            for (Payment payment : payments) {
                payment.setStatus(PaymentStatus.COMPLETED);
                payment.setResultDesc("Reconciled via STK query (callback not received)");
                paymentRepository.save(payment);
                applyPaymentToContribution(payment.getContribution(), payment.getAmount());
                notificationService.notifyPaymentReceived(payment);
            }
            log.info("Reconciled checkoutRequestId={} as COMPLETED via STK query", checkoutRequestId);
        } else if (result.getResultCode() != null) {
            PaymentStatus status = result.getResultCode() == RESULT_CODE_CANCELLED
                    ? PaymentStatus.CANCELLED
                    : PaymentStatus.FAILED;
            for (Payment payment : payments) {
                payment.setStatus(status);
                payment.setResultDesc("Reconciled via STK query: " + result.getResultDesc());
                paymentRepository.save(payment);
                notificationService.notifyPaymentFailed(payment, status);
            }
            log.info("Reconciled checkoutRequestId={} as {} via STK query", checkoutRequestId, status);
        } else if (createdAt.isBefore(LocalDateTime.now().minus(timeoutAfter))) {
            for (Payment payment : payments) {
                payment.setStatus(PaymentStatus.TIMEOUT);
                payment.setResultDesc("No callback or definitive STK query result received within the reconciliation window");
                paymentRepository.save(payment);
            }
            log.warn("checkoutRequestId={} timed out with no definitive result", checkoutRequestId);
        }
        // else: genuinely still processing — leave PENDING, the next scheduled run will retry.
    }

    /** Normalizes 07XXXXXXXX / 7XXXXXXXX / 2547XXXXXXXX into Safaricom's required 2547XXXXXXXX form. */
    private String normalizePhoneNumber(String phoneNumber) {
        String digits = phoneNumber.replaceAll("[^0-9]", "");
        if (digits.startsWith("254")) return digits;
        if (digits.startsWith("0")) return "254" + digits.substring(1);
        return "254" + digits;
    }

    private String extractMpesaReceiptNumber(MpesaStkCallbackRequest.StkCallback callback) {
        if (callback.callbackMetadata() == null || callback.callbackMetadata().item() == null) return null;
        return callback.callbackMetadata().item().stream()
                .filter(i -> "MpesaReceiptNumber".equals(i.name()))
                .map(i -> String.valueOf(i.value()))
                .findFirst()
                .orElse(null);
    }

    private void applyPaymentToContribution(Contribution contribution, BigDecimal amount) {
        BigDecimal newPaid = contribution.getPaidAmount().add(amount);
        BigDecimal newBalance = contribution.getAmount().subtract(newPaid);

        contribution.setPaidAmount(newPaid);
        contribution.setBalance(newBalance);
        contribution.setSettled(newBalance.compareTo(BigDecimal.ZERO) <= 0);

        contributionRepository.save(contribution);
    }
}
