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
        int count = notificationService.send(request);
        return Map.of("sent", count, "message", "Notification sent to " + count + " user(s)");
    }

    /** Admin: send payment reminders to all members with unpaid contributions for the period */
    @PostMapping("/remind-unpaid")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> remindUnpaid(@RequestParam String period) {
        int count = notificationService.sendPaymentReminders(period);
        return Map.of("reminded", count, "message", "Payment reminders sent to " + count + " member(s)");
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
