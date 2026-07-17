package com.example.estate.service;

import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.*;
import com.example.estate.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContributionService {

    private final ContributionRepository contributionRepository;
    private final ContributionTypeRepository contributionTypeRepository;
    private final UserRepository userRepository;

    public List<Contribution> getUserContributions(Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return contributionRepository.findByUser(user);
    }

    public List<Contribution> getPendingContributions(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return contributionRepository.findByUserAndSettledFalse(user);
    }

    /**
     * Admin-triggered (and scheduler-invoked): generate contributions for all active users
     * for the given period. Generates MONTHLY and ONE_TIME types for month periods, and
     * ANNUAL types for year-only periods. ONE_TIME types are generated at most once per
     * user ever, regardless of which period they're generated under.
     * Returns the contribution rows actually created, so callers can show the admin exactly
     * what was generated rather than just a count.
     */
    public List<Contribution> generateContributionsForPeriod(String period) {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .toList();

        // Detect if period is a year-only string ("2026") or a month string ("2026-03")
        boolean isYearOnly = period.matches("\\d{4}");

        List<ContributionType> monthlyTypes =
                contributionTypeRepository.findByFrequency(ContributionFrequency.MONTHLY)
                        .stream().filter(t -> Boolean.TRUE.equals(t.getActive())).toList();

        List<ContributionType> annualTypes =
                contributionTypeRepository.findByFrequency(ContributionFrequency.ANNUAL)
                        .stream().filter(t -> Boolean.TRUE.equals(t.getActive())).toList();

        List<ContributionType> oneTimeTypes =
                contributionTypeRepository.findByFrequency(ContributionFrequency.ONE_TIME)
                        .stream().filter(t -> Boolean.TRUE.equals(t.getActive())).toList();

        List<Contribution> created = new ArrayList<>();
        for (User user : users) {
            if (!isYearOnly) {
                // Monthly period: generate MONTHLY and ONE_TIME types
                for (ContributionType type : monthlyTypes) {
                    if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, period)) {
                        created.add(save(user, type, period));
                    }
                }
                for (ContributionType type : oneTimeTypes) {
                    if (!contributionRepository.existsByUserAndContributionType(user, type)) {
                        created.add(save(user, type, period));
                    }
                }
            } else {
                // Year-only period: generate ANNUAL types
                for (ContributionType type : annualTypes) {
                    if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, period)) {
                        created.add(save(user, type, period));
                    }
                }
            }
        }
        log.info("Generated {} contributions for period '{}'", created.size(), period);
        return created;
    }

    private Contribution save(User user, ContributionType type, String period) {
        return contributionRepository.save(Contribution.builder()
                .user(user)
                .contributionType(type)
                .amount(type.getAmount())
                .paidAmount(BigDecimal.ZERO)
                .balance(type.getAmount())
                .period(period)
                .dueDate(computeDueDate(type, period))
                .settled(false)
                .build());
    }

    /** Derives a concrete due date from the type's due-day-of-month and a "YYYY-MM" period. Null otherwise. */
    private LocalDate computeDueDate(ContributionType type, String period) {
        if (type.getDueDay() == null) return null;
        try {
            YearMonth yearMonth = YearMonth.parse(period);
            int day = Math.min(type.getDueDay(), yearMonth.lengthOfMonth());
            return yearMonth.atDay(day);
        } catch (Exception e) {
            return null;
        }
    }

}
