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
        YearMonth ym = YearMonth.parse(period);
        List<User> users = userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .toList();

        List<ContributionType> monthlyTypes =
                contributionTypeRepository.findByFrequency(ContributionFrequency.MONTHLY)
                        .stream().filter(t -> Boolean.TRUE.equals(t.getActive())).toList();

        List<ContributionType> annualTypes =
                contributionTypeRepository.findByFrequency(ContributionFrequency.ANNUAL)
                        .stream().filter(t -> Boolean.TRUE.equals(t.getActive())).toList();

        int count = 0;
        for (User user : users) {
            for (ContributionType type : monthlyTypes) {
                if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, period)) {
                    save(user, type, period);
                    count++;
                }
            }
            // Annual types only in January
            if (ym.getMonthValue() == 1) {
                for (ContributionType type : annualTypes) {
                    String annualPeriod = String.valueOf(ym.getYear());
                    if (!contributionRepository.existsByUserAndContributionTypeAndPeriod(user, type, annualPeriod)) {
                        save(user, type, annualPeriod);
                        count++;
                    }
                }
            }
        }
        log.info("Generated {} contributions for period {}", count, period);
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
