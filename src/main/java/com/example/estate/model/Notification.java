package com.example.estate.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** Set only for automated per-contribution reminders; used to prevent re-sending the
     *  same offset's reminder for the same contribution (see reminderOffsetDays). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contribution_id")
    private Contribution contribution;

    /** Days relative to the contribution's due date this reminder represents (negative =
     *  before due, 0 = due date, positive = overdue/escalation). Null for non-reminder notifications. */
    private Integer reminderOffsetDays;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    // VARCHAR, not a native MySQL ENUM — see Payment.method for why (ddl-auto=update never
    // widens an existing ENUM column's value list when a new Java enum constant is added).
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "VARCHAR(30)")
    @Builder.Default
    private NotificationType type = NotificationType.INFO;

    // Column explicitly named to avoid "read", a reserved word in MySQL — Hibernate doesn't
    // quote it automatically, so `create table notifications (... read bit ...)` silently
    // fails as a SQL syntax error and the table is never created under ddl-auto=update.
    @Column(name = "is_read")
    @Builder.Default
    private Boolean read = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private String sentBy;

    /** Groups all notifications created by one admin send/broadcast/reminder call, so delivery
     *  outcomes (async email/SMS) can be summarized after the fact via the batch-summary endpoint. */
    private String batchId;

    // Delivery tracking — null means "not attempted" (e.g. user has no email on file)
    private Boolean emailSent;
    private String emailError;
    private Boolean smsSent;
    private String smsError;

    public enum NotificationType { INFO, WARNING, ALERT, PAYMENT_REMINDER }
}
