package com.example.estate.service;

import com.example.estate.dto.BulkPaymentRequest;
import com.example.estate.dto.MpesaStkCallbackRequest;
import com.example.estate.enums.ContributionFrequency;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.Contribution;
import com.example.estate.model.ContributionType;
import com.example.estate.model.Payment;
import com.example.estate.model.User;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private ContributionRepository contributionRepository;
    @Mock private DarajaClient darajaClient;
    @Mock private NotificationService notificationService;

    private PaymentService service;
    private User user;
    private Contribution contribution;

    @BeforeEach
    void setUp() {
        service = new PaymentService(paymentRepository, contributionRepository, darajaClient, notificationService);

        user = User.builder().fullName("Jane Doe").phoneNumber("0712345678").password("hash").active(true).build();
        user.setId(1L);

        ContributionType type = ContributionType.builder().name("Service Fee")
                .amount(BigDecimal.valueOf(1000)).frequency(ContributionFrequency.MONTHLY).active(true).build();
        type.setId(1L);

        contribution = Contribution.builder().user(user).contributionType(type)
                .amount(BigDecimal.valueOf(1000)).paidAmount(BigDecimal.ZERO)
                .balance(BigDecimal.valueOf(1000)).period("2026-07").settled(false).build();
        contribution.setId(1L);
    }

    private Payment pendingPayment(String checkoutRequestId) {
        Payment payment = Payment.builder()
                .user(user).contribution(contribution).amount(contribution.getBalance())
                .method(PaymentMethod.MPESA).status(PaymentStatus.PENDING)
                .checkoutRequestId(checkoutRequestId).build();
        payment.setId(1L);
        return payment;
    }

    private MpesaStkCallbackRequest callback(String checkoutRequestId, int resultCode, String resultDesc, String receipt) {
        MpesaStkCallbackRequest.CallbackMetadata metadata = receipt == null ? null
                : new MpesaStkCallbackRequest.CallbackMetadata(List.of(
                        new MpesaStkCallbackRequest.Item("MpesaReceiptNumber", receipt)));
        return new MpesaStkCallbackRequest(new MpesaStkCallbackRequest.Body(
                new MpesaStkCallbackRequest.StkCallback("merchant-1", checkoutRequestId, resultCode, resultDesc, metadata)));
    }

    @Test
    void successfulCallback_marksCompletedAndAppliesBalance() {
        Payment payment = pendingPayment("chk-1");
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-1")).thenReturn(List.of(payment));

        service.handleStkCallback(callback("chk-1", 0, "Success", "REC123"), "raw");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(payment.getTransactionReference()).isEqualTo("REC123");
        assertThat(contribution.getBalance()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(contribution.getSettled()).isTrue();
        verify(notificationService, times(1)).notifyPaymentReceived(payment);
    }

    @Test
    void duplicateCallback_isIgnored() {
        Payment payment = pendingPayment("chk-2");
        payment.setStatus(PaymentStatus.COMPLETED); // already resolved by a prior callback

        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-2")).thenReturn(List.of(payment));

        service.handleStkCallback(callback("chk-2", 0, "Success", "REC999"), "raw");

        verify(paymentRepository, never()).save(any());
        verify(notificationService, never()).notifyPaymentReceived(any());
    }

    @Test
    void failedCallback_marksFailedAndDoesNotTouchBalance() {
        Payment payment = pendingPayment("chk-3");
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-3")).thenReturn(List.of(payment));

        service.handleStkCallback(callback("chk-3", 1, "Insufficient funds", null), "raw");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(payment.getResultDesc()).isEqualTo("Insufficient funds");
        assertThat(contribution.getBalance()).isEqualByComparingTo(BigDecimal.valueOf(1000));
        verify(notificationService, never()).notifyPaymentReceived(any());
        verify(notificationService, times(1)).notifyPaymentFailed(payment, PaymentStatus.FAILED);
    }

    @Test
    void cancelledCallback_marksCancelled() {
        Payment payment = pendingPayment("chk-4");
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-4")).thenReturn(List.of(payment));

        service.handleStkCallback(callback("chk-4", 1032, "Request cancelled by user", null), "raw");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.CANCELLED);
        verify(notificationService, times(1)).notifyPaymentFailed(payment, PaymentStatus.CANCELLED);
    }

    @Test
    void bulkCallback_resolvesAllContributionsSharingCheckoutRequestId() {
        ContributionType type = contribution.getContributionType();

        Contribution second = Contribution.builder().user(user).contributionType(type)
                .amount(BigDecimal.valueOf(500)).paidAmount(BigDecimal.ZERO)
                .balance(BigDecimal.valueOf(500)).period("2026-08").settled(false).build();
        second.setId(2L);

        Payment paymentOne = pendingPayment("chk-bulk");
        Payment paymentTwo = Payment.builder()
                .user(user).contribution(second).amount(second.getBalance())
                .method(PaymentMethod.MPESA).status(PaymentStatus.PENDING)
                .checkoutRequestId("chk-bulk").build();
        paymentTwo.setId(2L);

        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-bulk")).thenReturn(List.of(paymentOne, paymentTwo));

        service.handleStkCallback(callback("chk-bulk", 0, "Success", "REC777"), "raw");

        assertThat(paymentOne.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(paymentTwo.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(contribution.getSettled()).isTrue();
        assertThat(second.getSettled()).isTrue();
        verify(notificationService, times(2)).notifyPaymentReceived(any());
    }

    @Test
    void getStatus_returnsSharedStatusAcrossBulkPushRows() {
        Payment payment = pendingPayment("chk-status");
        payment.setStatus(PaymentStatus.COMPLETED);
        when(paymentRepository.findAllByCheckoutRequestId("chk-status")).thenReturn(List.of(payment));

        assertThat(service.getStatusByCheckoutRequestId("chk-status")).isEqualTo(PaymentStatus.COMPLETED);
    }

    @Test
    void getStatus_throwsWhenCheckoutRequestIdUnknown() {
        when(paymentRepository.findAllByCheckoutRequestId("chk-missing")).thenReturn(List.of());

        assertThatThrownBy(() -> service.getStatusByCheckoutRequestId("chk-missing"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void bulkStkPush_savesOnePaymentRowPerContributionSharingOneCheckoutRequestId() {
        ContributionType type = contribution.getContributionType();
        Contribution second = Contribution.builder().user(user).contributionType(type)
                .amount(BigDecimal.valueOf(500)).paidAmount(BigDecimal.ZERO)
                .balance(BigDecimal.valueOf(500)).period("2026-08").settled(false).build();
        second.setId(2L);

        when(contributionRepository.findById(1L)).thenReturn(Optional.of(contribution));
        when(contributionRepository.findById(2L)).thenReturn(Optional.of(second));
        when(darajaClient.initiateStkPush(any(), anyLong(), any(), any()))
                .thenReturn(new DarajaClient.StkPushResult("merchant-1", "chk-bulk-new", "Check your phone"));

        service.initiateBulkStkPush(List.of(1L, 2L), "0712345678");

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository, times(2)).save(captor.capture());
        // Not blocked by a unique constraint at the entity-mapping level: both rows share one checkoutRequestId.
        assertThat(captor.getAllValues()).extracting(Payment::getCheckoutRequestId)
                .containsExactly("chk-bulk-new", "chk-bulk-new");
    }

    @Test
    void bulkPay_doesNotApplyAnyPaymentWhenOneContributionIdIsInvalid() {
        BulkPaymentRequest req = new BulkPaymentRequest();
        req.setIds(List.of(1L, 999L));
        req.setMethod(PaymentMethod.BANK);
        req.setReference("REF");

        when(contributionRepository.findById(1L)).thenReturn(Optional.of(contribution));
        when(contributionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.bulkPay(req)).isInstanceOf(RuntimeException.class);
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void reconcile_skipsWhenAlreadyResolvedByARealCallback() {
        Payment payment = pendingPayment("chk-recon-1");
        payment.setStatus(PaymentStatus.COMPLETED);
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-recon-1")).thenReturn(List.of(payment));

        service.reconcilePendingPayment("chk-recon-1", Duration.ofMinutes(30));

        verifyNoInteractions(darajaClient);
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void reconcile_appliesPaymentWhenQueryConfirmsSuccessButCallbackNeverArrived() {
        Payment payment = pendingPayment("chk-recon-2");
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-recon-2")).thenReturn(List.of(payment));
        when(darajaClient.queryStkPushStatus("chk-recon-2"))
                .thenReturn(new DarajaClient.StkQueryResult(0, "Success"));

        service.reconcilePendingPayment("chk-recon-2", Duration.ofMinutes(30));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(contribution.getSettled()).isTrue();
        verify(notificationService, times(1)).notifyPaymentReceived(payment);
    }

    @Test
    void reconcile_marksFailedWhenQueryReturnsDefinitiveFailure() {
        Payment payment = pendingPayment("chk-recon-3");
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-recon-3")).thenReturn(List.of(payment));
        when(darajaClient.queryStkPushStatus("chk-recon-3"))
                .thenReturn(new DarajaClient.StkQueryResult(1, "Insufficient funds"));

        service.reconcilePendingPayment("chk-recon-3", Duration.ofMinutes(30));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.FAILED);
        verify(notificationService, times(1)).notifyPaymentFailed(payment, PaymentStatus.FAILED);
    }

    @Test
    void reconcile_marksTimeoutWhenNoDefinitiveResultAndPastTimeoutWindow() {
        Payment payment = pendingPayment("chk-recon-4");
        payment.setCreatedAt(LocalDateTime.now().minusHours(1));
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-recon-4")).thenReturn(List.of(payment));
        when(darajaClient.queryStkPushStatus("chk-recon-4"))
                .thenReturn(new DarajaClient.StkQueryResult(null, "Still processing"));

        service.reconcilePendingPayment("chk-recon-4", Duration.ofMinutes(30));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.TIMEOUT);
    }

    @Test
    void reconcile_leavesPendingWhenNoDefinitiveResultAndWithinTimeoutWindow() {
        Payment payment = pendingPayment("chk-recon-5");
        payment.setCreatedAt(LocalDateTime.now().minusMinutes(5));
        when(paymentRepository.findAllByCheckoutRequestIdForUpdate("chk-recon-5")).thenReturn(List.of(payment));
        when(darajaClient.queryStkPushStatus("chk-recon-5"))
                .thenReturn(new DarajaClient.StkQueryResult(null, "Still processing"));

        service.reconcilePendingPayment("chk-recon-5", Duration.ofMinutes(30));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PENDING);
        verify(paymentRepository, never()).save(any());
    }
}
