package com.example.estate.scheduler;

import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.Payment;
import com.example.estate.repository.PaymentRepository;
import com.example.estate.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Sweeps STK push payments that never received a Safaricom callback, so they don't sit
 * PENDING forever. Safaricom's callback normally lands within seconds, so anything still
 * PENDING after {@link #QUERY_AFTER} is worth an active STK query; anything that still has
 * no definitive result after {@link #TIMEOUT_AFTER} is marked TIMEOUT.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentReconciliationScheduler {

    private static final Duration QUERY_AFTER = Duration.ofMinutes(2);
    private static final Duration TIMEOUT_AFTER = Duration.ofMinutes(30);

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;

    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void reconcileStalePendingPayments() {
        LocalDateTime queryThreshold = LocalDateTime.now().minus(QUERY_AFTER);
        List<Payment> stale = paymentRepository.findByStatusAndCreatedAtBefore(PaymentStatus.PENDING, queryThreshold);
        if (stale.isEmpty()) {
            return;
        }

        // A bulk STK push shares one checkoutRequestId across several Payment rows — reconcile once per group.
        List<String> checkoutRequestIds = stale.stream()
                .map(Payment::getCheckoutRequestId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        log.info("Reconciling {} stale PENDING checkoutRequestId group(s)", checkoutRequestIds.size());
        for (String checkoutRequestId : checkoutRequestIds) {
            try {
                paymentService.reconcilePendingPayment(checkoutRequestId, TIMEOUT_AFTER);
            } catch (Exception e) {
                log.error("Reconciliation failed for checkoutRequestId={}", checkoutRequestId, e);
            }
        }
    }
}
