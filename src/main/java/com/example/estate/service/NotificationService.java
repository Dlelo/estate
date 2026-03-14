package com.example.estate.service;

import com.example.estate.dto.SendNotificationRequest;
import com.example.estate.model.Notification;
import com.example.estate.model.User;
import com.example.estate.repository.NotificationRepository;
import com.example.estate.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    /** Admin: send to one user or broadcast to all active users */
    public int send(SendNotificationRequest req) {
        String sentBy = SecurityContextHolder.getContext().getAuthentication().getName();

        if (req.getUserId() != null) {
            // Single user
            User user = userRepository.findById(req.getUserId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            notificationRepository.save(build(user, req, sentBy));
            return 1;
        } else {
            // Broadcast
            List<User> activeUsers = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()) && !Boolean.TRUE.equals(u.getDeleted()))
                    .toList();
            activeUsers.forEach(u -> notificationRepository.save(build(u, req, sentBy)));
            return activeUsers.size();
        }
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

    private Notification build(User user, SendNotificationRequest req, String sentBy) {
        return Notification.builder()
                .user(user)
                .title(req.getTitle())
                .message(req.getMessage())
                .type(req.getType())
                .sentBy(sentBy)
                .read(false)
                .build();
    }
}
