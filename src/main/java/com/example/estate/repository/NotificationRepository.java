package com.example.estate.repository;

import com.example.estate.model.Contribution;
import com.example.estate.model.Notification;
import com.example.estate.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserOrderByCreatedAtDesc(User user);

    long countByUserAndReadFalse(User user);

    // 🔹 Duplicate prevention for scheduled per-contribution reminders: has this exact
    // offset already been sent for this contribution since the given instant (today)?
    boolean existsByContributionAndReminderOffsetDaysAndCreatedAtAfter(
            Contribution contribution, Integer reminderOffsetDays, LocalDateTime since);

    // 🔹 Delivery summary for one admin send/broadcast/reminder call. Email/SMS outcomes are
    // written asynchronously after dispatch, so "pending" (null) means the async callback for
    // that channel hasn't landed yet — the admin UI polls this shortly after sending.
    @Query("""
            SELECT COUNT(n) AS total,
                   SUM(CASE WHEN n.emailSent = true THEN 1 ELSE 0 END) AS emailDelivered,
                   SUM(CASE WHEN n.emailSent = false THEN 1 ELSE 0 END) AS emailFailed,
                   SUM(CASE WHEN n.smsSent = true THEN 1 ELSE 0 END) AS smsDelivered,
                   SUM(CASE WHEN n.smsSent = false THEN 1 ELSE 0 END) AS smsFailed
            FROM Notification n
            WHERE n.batchId = :batchId
           """)
    BatchDeliverySummary getBatchDeliverySummary(@Param("batchId") String batchId);

    interface BatchDeliverySummary {
        long getTotal();
        Long getEmailDelivered();
        Long getEmailFailed();
        Long getSmsDelivered();
        Long getSmsFailed();
    }

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.user = :user AND n.read = false")
    void markAllReadForUser(User user);
}
