package com.example.estate.service;

import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.*;
import com.example.estate.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContributionService {

    private final ContributionRepository contributionRepository;
    private final ContributionTypeRepository contributionTypeRepository;
    private final UserRepository userRepository;

    public Contribution createContribution(Long userId, Long typeId, String period) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ContributionType type = contributionTypeRepository.findById(typeId)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));

        Contribution contribution = Contribution.builder()
                .user(user)
                .contributionType(type)
                .amount(type.getAmount())
                .paidAmount(BigDecimal.ZERO)
                .balance(type.getAmount())
                .period(period)
                .settled(false)
                .build();

        return contributionRepository.save(contribution);
    }

    public List<Contribution> getUserContributions(Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return contributionRepository.findByUser(user);
    }

    public BigDecimal getUserOutstandingBalance(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return contributionRepository.getTotalOutstandingBalance(user);
    }

    public List<Contribution> getPendingContributions(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return contributionRepository.findByUserAndSettledFalse(user);
    }

    /**
     * Admin-triggered: generate contributions for all active users for the given period.
     * Generates both MONTHLY types every call, and ANNUAL types only for January periods.
     */
    public void generateContributionsForPeriod(String period) {
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

        int count = 0;
        for (User user : users) {
            if (!isYearOnly) {
                // Monthly period: generate MONTHLY and ONE_TIME types
                for (ContributionType type : monthlyTypes) {
                    if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, period)) {
                        save(user, type, period);
                        count++;
                    }
                }
                for (ContributionType type : oneTimeTypes) {
                    if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, period)) {
                        save(user, type, period);
                        count++;
                    }
                }
            } else {
                // Year-only period: generate ANNUAL types
                for (ContributionType type : annualTypes) {
                    if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, period)) {
                        save(user, type, period);
                        count++;
                    }
                }
            }
        }
        log.info("Generated {} contributions for period '{}'", count, period);
    }

    private void save(User user, ContributionType type, String period) {
        contributionRepository.save(Contribution.builder()
                .user(user)
                .contributionType(type)
                .amount(type.getAmount())
                .paidAmount(BigDecimal.ZERO)
                .balance(type.getAmount())
                .period(period)
                .settled(false)
                .build());
    }

}
