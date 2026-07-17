package com.example.estate.service;

import com.example.estate.dto.SendNotificationRequest;
import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.Contribution;
import com.example.estate.model.ContributionType;
import com.example.estate.model.Notification;
import com.example.estate.model.User;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.NotificationRepository;
import com.example.estate.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private ContributionRepository contributionRepository;
    @Mock private EmailService emailService;
    @Mock private SmsService smsService;

    private NotificationService service;
    private User user;
    private Contribution contribution;

    @BeforeEach
    void setUp() {
        service = new NotificationService(notificationRepository, userRepository, contributionRepository, emailService, smsService);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin-user", null, List.of()));

        user = User.builder().fullName("Jane Doe").phoneNumber("0712345678").email("jane@example.com")
                .password("hash").active(true).build();
        user.setId(1L);

        ContributionType type = ContributionType.builder().name("Service Fee")
                .amount(BigDecimal.valueOf(1000)).frequency(ContributionFrequency.MONTHLY).active(true).build();
        type.setId(1L);

        contribution = Contribution.builder().user(user).contributionType(type)
                .amount(BigDecimal.valueOf(1000)).paidAmount(BigDecimal.ZERO)
                .balance(BigDecimal.valueOf(1000)).period("2026-07").settled(false).build();
        contribution.setId(1L);

        // dispatchChannels always awaits these futures — stub them so it never NPEs on .thenAccept
        lenient().when(emailService.send(any(), any(), any()))
                .thenReturn(CompletableFuture.completedFuture(new EmailService.Result(true, null)));
        lenient().when(smsService.send(any(), any()))
                .thenReturn(CompletableFuture.completedFuture(new SmsService.Result(true, null)));
        lenient().when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void send_toSingleUser_tagsOneBatchId() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        SendNotificationRequest req = new SendNotificationRequest();
        req.setUserId(1L);
        req.setTitle("Hello");
        req.setMessage("World");
        req.setType(Notification.NotificationType.INFO);

        NotificationService.SendResult result = service.send(req);

        assertThat(result.count()).isEqualTo(1);
        assertThat(result.batchId()).isNotBlank();

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getBatchId()).isEqualTo(result.batchId());
    }

    @Test
    void send_broadcast_onlyReachesActiveNonDeletedUsers() {
        User inactive = User.builder().fullName("Inactive Guy").phoneNumber("0700000000")
                .password("hash").active(false).build();
        inactive.setId(2L);

        when(userRepository.findAll()).thenReturn(List.of(user, inactive));
        SendNotificationRequest req = new SendNotificationRequest();
        req.setUserId(null);
        req.setTitle("Broadcast");
        req.setMessage("To everyone active");
        req.setType(Notification.NotificationType.WARNING);

        NotificationService.SendResult result = service.send(req);

        assertThat(result.count()).isEqualTo(1);
        verify(notificationRepository, times(1)).save(any(Notification.class));
    }

    @Test
    void sendPaymentReminders_groupsUnpaidContributionsByUserInOneQuery() {
        Contribution second = Contribution.builder().user(user).contributionType(contribution.getContributionType())
                .amount(BigDecimal.valueOf(500)).paidAmount(BigDecimal.ZERO)
                .balance(BigDecimal.valueOf(500)).period("2026-07").settled(false).build();
        second.setId(2L);

        when(contributionRepository.findByPeriodAndSettledFalse("2026-07")).thenReturn(List.of(contribution, second));

        NotificationService.SendResult result = service.sendPaymentReminders("2026-07");

        assertThat(result.count()).isEqualTo(1); // one user, two unpaid contributions -> one reminder
        verify(contributionRepository, times(1)).findByPeriodAndSettledFalse("2026-07");
        verify(userRepository, never()).findAll(); // no per-user lookups — avoids the old N+1 pattern

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getMessage()).contains("2 unsettled contribution(s)");
        assertThat(captor.getValue().getBatchId()).isEqualTo(result.batchId());
    }

    @Test
    void sendPaymentReminders_skipsInactiveUsersEvenIfTheyHaveUnpaidContributions() {
        user.setActive(false);
        when(contributionRepository.findByPeriodAndSettledFalse("2026-07")).thenReturn(List.of(contribution));

        NotificationService.SendResult result = service.sendPaymentReminders("2026-07");

        assertThat(result.count()).isZero();
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void sendContributionReminder_sendsWhenNotAlreadySentForThisOffsetToday() {
        when(notificationRepository.existsByContributionAndReminderOffsetDaysAndCreatedAtAfter(
                eq(contribution), eq(-3), any(LocalDateTime.class))).thenReturn(false);

        boolean sent = service.sendContributionReminder(contribution, -3);

        assertThat(sent).isTrue();
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getReminderOffsetDays()).isEqualTo(-3);
        assertThat(captor.getValue().getContribution()).isEqualTo(contribution);
    }

    @Test
    void sendContributionReminder_isANoOpWhenThatOffsetAlreadySentToday() {
        when(notificationRepository.existsByContributionAndReminderOffsetDaysAndCreatedAtAfter(
                eq(contribution), eq(0), any(LocalDateTime.class))).thenReturn(true);

        boolean sent = service.sendContributionReminder(contribution, 0);

        assertThat(sent).isFalse();
        verify(notificationRepository, never()).save(any());
    }
}
