package com.example.estate.scheduler;

import com.example.estate.config.ReminderProperties;
import com.example.estate.model.Contribution;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily sweep for outstanding-payment reminders, driven by {@link ReminderProperties} so the
 * cadence (before-due / on-due / overdue escalation) is admin-configurable without a code
 * change. Duplicate sends are prevented per contribution+offset by NotificationService.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentReminderScheduler {

    private final ContributionRepository contributionRepository;
    private final NotificationService notificationService;
    private final ReminderProperties reminderProperties;

    @Scheduled(cron = "0 0 8 * * ?") // 08:00 daily
    public void sendDueDateReminders() {
        LocalDate today = LocalDate.now();
        int sent = 0;

        for (int daysBefore : reminderProperties.getDaysBeforeDue()) {
            sent += remindForOffset(today.plusDays(daysBefore), -daysBefore);
        }

        if (reminderProperties.isRemindOnDueDate()) {
            sent += remindForOffset(today, 0);
        }

        for (int daysAfter : reminderProperties.getDaysAfterDue()) {
            sent += remindForOffset(today.minusDays(daysAfter), daysAfter);
        }

        log.info("Payment reminder sweep sent {} reminder(s) for {}", sent, today);
    }

    private int remindForOffset(LocalDate dueDate, int offsetDays) {
        List<Contribution> due = contributionRepository.findBySettledFalseAndDueDate(dueDate);
        int sent = 0;
        for (Contribution contribution : due) {
            if (notificationService.sendContributionReminder(contribution, offsetDays)) {
                sent++;
            }
        }
        return sent;
    }
}
