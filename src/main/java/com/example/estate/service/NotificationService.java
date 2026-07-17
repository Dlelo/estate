package com.example.estate.service;

import com.example.estate.dto.SendNotificationRequest;
import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.Notification;
import com.example.estate.model.Payment;
import com.example.estate.model.User;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.NotificationRepository;
import com.example.estate.repository.UserRepository;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ContributionRepository contributionRepository;
    private final EmailService emailService;
    private final SmsService smsService;

    /** Result of a send/broadcast/reminder call: how many recipients were queued, and a
     *  batchId the caller can poll via getBatchDeliverySummary() for async outcomes. */
    public record SendResult(int count, String batchId) {}

    /** Admin: send to one user or broadcast to all active users */
    public SendResult send(SendNotificationRequest req) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        String sentBy = authentication != null ? authentication.getName() : "System";
        String batchId = UUID.randomUUID().toString();

        if (req.getUserId() != null) {
            // Single user
            User user = userRepository.findById(req.getUserId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            Notification saved = notificationRepository.save(build(user, req, sentBy, batchId));
            dispatchChannels(saved, user);
            return new SendResult(1, batchId);
        } else {
            // Broadcast
            List<User> activeUsers = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()) && !Boolean.TRUE.equals(u.getDeleted()))
                    .toList();
            activeUsers.forEach(u -> {
                Notification saved = notificationRepository.save(build(u, req, sentBy, batchId));
                dispatchChannels(saved, u);
            });
            return new SendResult(activeUsers.size(), batchId);
        }
    }

    /** Delivery outcome summary for a batchId returned by send()/sendPaymentReminders(). Email/SMS
     *  counts only include recipients who actually had that contact channel on file. */
    @Transactional(readOnly = true)
    public NotificationRepository.BatchDeliverySummary getBatchDeliverySummary(String batchId) {
        return notificationRepository.getBatchDeliverySummary(batchId);
    }

    /** User: get all their notifications */
    @Transactional(readOnly = true)
    public List<Notification> getForUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return notificationRepository.findByUserOrderByCreatedAtDesc(user);
    }

    /** User: count unread */
    @Transactional(readOnly = true)
    public long countUnread(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return notificationRepository.countByUserAndReadFalse(user);
    }

    /** User: mark single notification as read */
    public void markRead(Long notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        n.setRead(true);
        notificationRepository.save(n);
    }

    /** User: mark all as read */
    public void markAllRead(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        notificationRepository.markAllReadForUser(user);
    }

    /** Admin: send payment reminders to all members who have unsettled contributions for the given period */
    public SendResult sendPaymentReminders(String period) {
        String batchId = UUID.randomUUID().toString();

        // Single query for the whole period, grouped by user in memory — avoids a
        // per-user round trip when there are hundreds/thousands of active members.
        Map<User, List<com.example.estate.model.Contribution>> unpaidByUser =
                contributionRepository.findByPeriodAndSettledFalse(period).stream()
                        .collect(Collectors.groupingBy(com.example.estate.model.Contribution::getUser));

        int count = 0;
        for (Map.Entry<User, List<com.example.estate.model.Contribution>> entry : unpaidByUser.entrySet()) {
            User user = entry.getKey();
            if (!Boolean.TRUE.equals(user.getActive()) || Boolean.TRUE.equals(user.getDeleted())) {
                continue;
            }
            List<com.example.estate.model.Contribution> unpaid = entry.getValue();

            BigDecimal totalDue = unpaid.stream()
                    .map(com.example.estate.model.Contribution::getBalance)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Notification saved = notificationRepository.save(Notification.builder()
                    .user(user)
                    .batchId(batchId)
                    .title("Payment Reminder – " + period)
                    .message(String.format(
                            "You have %d unsettled contribution(s) for %s totalling KSh %.2f. Please make payment at your earliest convenience.",
                            unpaid.size(), period, totalDue))
                    .type(Notification.NotificationType.PAYMENT_REMINDER)
                    .sentBy("System")
                    .read(false)
                    .build());
            dispatchChannels(saved, user);
            count++;
        }
        return new SendResult(count, batchId);
    }

    /**
     * Scheduled due-date reminder for a single contribution (before/on/after its due date,
     * including overdue escalation). Returns false without sending if this exact offset was
     * already sent for this contribution (duplicate prevention across scheduler runs).
     */
    public boolean sendContributionReminder(com.example.estate.model.Contribution contribution, int offsetDays) {
        java.time.LocalDateTime todayStart = java.time.LocalDate.now().atStartOfDay();
        boolean alreadySent = notificationRepository.existsByContributionAndReminderOffsetDaysAndCreatedAtAfter(
                contribution, offsetDays, todayStart);
        if (alreadySent) {
            return false;
        }

        User user = contribution.getUser();
        String title;
        String message;
        if (offsetDays < 0) {
            title = "Upcoming Payment Due in " + (-offsetDays) + " day(s)";
            message = String.format(
                    "Your %s contribution for %s (KSh %.2f) is due on %s.",
                    contribution.getContributionType().getName(), contribution.getPeriod(),
                    contribution.getBalance(), contribution.getDueDate());
        } else if (offsetDays == 0) {
            title = "Payment Due Today";
            message = String.format(
                    "Your %s contribution for %s (KSh %.2f) is due today.",
                    contribution.getContributionType().getName(), contribution.getPeriod(), contribution.getBalance());
        } else {
            title = "Overdue Payment – " + offsetDays + " day(s) past due";
            message = String.format(
                    "Your %s contribution for %s (KSh %.2f) was due on %s and is now %d day(s) overdue. Please settle it as soon as possible.",
                    contribution.getContributionType().getName(), contribution.getPeriod(),
                    contribution.getBalance(), contribution.getDueDate(), offsetDays);
        }

        Notification saved = notificationRepository.save(Notification.builder()
                .user(user)
                .contribution(contribution)
                .reminderOffsetDays(offsetDays)
                .title(title)
                .message(message)
                .type(Notification.NotificationType.PAYMENT_REMINDER)
                .sentBy("System")
                .read(false)
                .build());
        dispatchChannels(saved, user);
        return true;
    }

    /** Notify a member that their payment has been received and applied. */
    public void notifyPaymentReceived(Payment payment) {
        User user = payment.getUser();
        var contribution = payment.getContribution();

        String title = "Payment Received";
        String message = String.format(
                "Payment of KSh %.2f received for %s (%s). Receipt: %s. New balance: KSh %.2f.",
                payment.getAmount(),
                contribution.getContributionType().getName(),
                contribution.getPeriod(),
                payment.getTransactionReference() != null ? payment.getTransactionReference() : "N/A",
                contribution.getBalance());

        Notification saved = notificationRepository.save(Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(Notification.NotificationType.INFO)
                .sentBy("System")
                .read(false)
                .build());
        dispatchChannels(saved, user);
    }

    /** Notify a member that their M-Pesa payment failed or was cancelled. */
    public void notifyPaymentFailed(Payment payment, PaymentStatus status) {
        User user = payment.getUser();
        var contribution = payment.getContribution();

        boolean cancelled = status == PaymentStatus.CANCELLED;
        String title = cancelled ? "Payment Cancelled" : "Payment Failed";
        String message = String.format(
                "Your payment of KSh %.2f for %s (%s) %s.%s",
                payment.getAmount(),
                contribution.getContributionType().getName(),
                contribution.getPeriod(),
                cancelled ? "was cancelled" : "failed",
                payment.getResultDesc() != null ? " Reason: " + payment.getResultDesc() : "");

        Notification saved = notificationRepository.save(Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(cancelled ? Notification.NotificationType.WARNING : Notification.NotificationType.ALERT)
                .sentBy("System")
                .read(false)
                .build());
        dispatchChannels(saved, user);
    }

    /** Fires the email/SMS channels for a saved notification and records delivery outcomes onto it. */
    private void dispatchChannels(Notification notification, User user) {
        Long notificationId = notification.getId();
        String subject = notification.getTitle();
        String body = notification.getMessage();

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.send(user.getEmail(), subject, body)
                    .thenAccept(result -> updateEmailOutcome(notificationId, result.success(), result.error()));
        }

        if (user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()) {
            smsService.send(user.getPhoneNumber(), subject + ": " + body)
                    .thenAccept(result -> updateSmsOutcome(notificationId, result.success(), result.error()));
        }
    }

    private void updateEmailOutcome(Long notificationId, boolean success, String error) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setEmailSent(success);
            n.setEmailError(error);
            notificationRepository.save(n);
        });
    }

    private void updateSmsOutcome(Long notificationId, boolean success, String error) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setSmsSent(success);
            n.setSmsError(error);
            notificationRepository.save(n);
        });
    }

    private Notification build(User user, SendNotificationRequest req, String sentBy, String batchId) {
        return Notification.builder()
                .user(user)
                .batchId(batchId)
                .title(req.getTitle())
                .message(req.getMessage())
                .type(req.getType())
                .sentBy(sentBy)
                .read(false)
                .build();
    }
}
