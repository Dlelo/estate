package com.example.estate.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

class ReminderPropertiesTest {

    @Configuration
    @EnableConfigurationProperties(ReminderProperties.class)
    static class TestConfig {}

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class);

    @Test
    void usesJavaFieldDefaultsWhenNoEnvVarsSet() {
        contextRunner.run(ctx -> {
            ReminderProperties props = ctx.getBean(ReminderProperties.class);
            assertThat(props.getDaysBeforeDue()).containsExactly(3, 1);
            assertThat(props.isRemindOnDueDate()).isTrue();
            assertThat(props.getDaysAfterDue()).containsExactly(3, 7, 14, 30);
        });
    }

    @Test
    void bindsCommaSeparatedListsFromRelaxedPropertyNames() {
        // Simulates what Spring Boot's relaxed binding does for REMINDER_DAYS_BEFORE_DUE etc.
        contextRunner
                .withPropertyValues(
                        "reminder.days-before-due=5,2",
                        "reminder.remind-on-due-date=false",
                        "reminder.days-after-due=1,10")
                .run(ctx -> {
                    ReminderProperties props = ctx.getBean(ReminderProperties.class);
                    assertThat(props.getDaysBeforeDue()).containsExactly(5, 2);
                    assertThat(props.isRemindOnDueDate()).isFalse();
                    assertThat(props.getDaysAfterDue()).containsExactly(1, 10);
                });
    }
}
