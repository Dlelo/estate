package com.example.estate.scheduler;

import com.example.estate.service.ContributionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Year;
import java.time.YearMonth;

@Slf4j
@Component
@RequiredArgsConstructor
public class MonthlyContributionScheduler {

    private final ContributionService contributionService;

    @Scheduled(cron = "0 0 0 1 * ?") // 1st day of every month
    public void generateMonthlyContributions() {
        String currentPeriod = YearMonth.now().toString();
        int count = contributionService.generateContributionsForPeriod(currentPeriod).size();
        log.info("Scheduled generation created {} contributions for period '{}'", count, currentPeriod);
    }

    @Scheduled(cron = "0 0 0 1 1 ?") // January 1st every year
    public void generateAnnualContributions() {
        String currentPeriod = String.valueOf(Year.now().getValue());
        int count = contributionService.generateContributionsForPeriod(currentPeriod).size();
        log.info("Scheduled generation created {} annual contributions for period '{}'", count, currentPeriod);
    }
}
