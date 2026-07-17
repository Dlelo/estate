package com.example.estate.controllers;

import com.example.estate.dto.SendNotificationRequest;
import com.example.estate.model.Notification;
import com.example.estate.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** Admin: send notification (single user or broadcast) */
    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> send(@Valid @RequestBody SendNotificationRequest request) {
        NotificationService.SendResult result = notificationService.send(request);
        return Map.of(
                "sent", result.count(),
                "batchId", result.batchId(),
                "message", "Notification queued for " + result.count() + " user(s)");
    }

    /** Admin: send payment reminders to all members with unpaid contributions for the period */
    @PostMapping("/remind-unpaid")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> remindUnpaid(@RequestParam String period) {
        NotificationService.SendResult result = notificationService.sendPaymentReminders(period);
        return Map.of(
                "reminded", result.count(),
                "batchId", result.batchId(),
                "message", "Payment reminders queued for " + result.count() + " member(s)");
    }

    /** Admin: delivery outcome summary for a batchId returned by /send or /remind-unpaid.
     *  Email/SMS results land asynchronously, so poll this shortly after sending. */
    @GetMapping("/batch/{batchId}/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> batchSummary(@PathVariable String batchId) {
        var summary = notificationService.getBatchDeliverySummary(batchId);
        long emailDelivered = summary.getEmailDelivered() != null ? summary.getEmailDelivered() : 0;
        long emailFailed = summary.getEmailFailed() != null ? summary.getEmailFailed() : 0;
        long smsDelivered = summary.getSmsDelivered() != null ? summary.getSmsDelivered() : 0;
        long smsFailed = summary.getSmsFailed() != null ? summary.getSmsFailed() : 0;
        long emailPending = summary.getTotal() - emailDelivered - emailFailed;
        long smsPending = summary.getTotal() - smsDelivered - smsFailed;
        return Map.of(
                "total", summary.getTotal(),
                "email", Map.of("delivered", emailDelivered, "failed", emailFailed, "pending", emailPending),
                "sms", Map.of("delivered", smsDelivered, "failed", smsFailed, "pending", smsPending));
    }

    /** User: get all notifications */
    @GetMapping("/user/{userId}")
    public List<Notification> getForUser(@PathVariable Long userId) {
        return notificationService.getForUser(userId);
    }

    /** User: count unread */
    @GetMapping("/user/{userId}/unread-count")
    public Map<String, Long> unreadCount(@PathVariable Long userId) {
        return Map.of("count", notificationService.countUnread(userId));
    }

    /** User: mark single as read */
    @PatchMapping("/{id}/read")
    public void markRead(@PathVariable Long id) {
        notificationService.markRead(id);
    }

    /** User: mark all as read */
    @PatchMapping("/user/{userId}/read-all")
    public void markAllRead(@PathVariable Long userId) {
        notificationService.markAllRead(userId);
    }
}
