package com.example.estate.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Admin-configurable outstanding-payment reminder schedule, relative to each contribution's
 * due date. Override via REMINDER_DAYS-BEFORE-DUE / REMINDER_REMIND-ON-DUE-DATE /
 * REMINDER_DAYS-AFTER-DUE env vars (comma-separated for the day lists) — no redeploy of code
 * needed to retune the cadence, just a container restart with new env values.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "reminder")
public class ReminderProperties {

    /** Days before the due date to send a reminder, e.g. [3, 1]. */
    private List<Integer> daysBeforeDue = List.of(3, 1);

    /** Whether to send a reminder on the due date itself. */
    private boolean remindOnDueDate = true;

    /** Escalating reminders after the due date has passed, e.g. [3, 7, 14, 30]. */
    private List<Integer> daysAfterDue = List.of(3, 7, 14, 30);
}
