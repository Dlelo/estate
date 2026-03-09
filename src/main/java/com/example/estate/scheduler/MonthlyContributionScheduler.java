package com.example.estate.scheduler;
import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.*;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.ContributionTypeRepository;
import com.example.estate.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.YearMonth;
import java.util.List;

@Component
@RequiredArgsConstructor
public class MonthlyContributionScheduler {

    private final UserRepository userRepository;
    private final ContributionTypeRepository typeRepository;
    private final ContributionRepository contributionRepository;

    @Scheduled(cron = "0 0 0 1 * ?") // 1st day of every month
    public void generateMonthlyContributions() {

        String currentPeriod = YearMonth.now().toString();

        List<User> users = userRepository.findAll();
        List<ContributionType> monthlyTypes =
                typeRepository.findByFrequency(ContributionFrequency.MONTHLY);

        for (User user : users) {
            for (ContributionType type : monthlyTypes) {

                boolean exists = contributionRepository
                        .existsByUserAndContributionTypeAndPeriod(user, type, currentPeriod);

                if (!exists) {
                    Contribution contribution = Contribution.builder()
                            .user(user)
                            .contributionType(type)
                            .amount(type.getAmount())
                            .paidAmount(java.math.BigDecimal.ZERO)
                            .balance(type.getAmount())
                            .period(currentPeriod)
                            .settled(false)
                            .build();

                    contributionRepository.save(contribution);
                }
            }
        }
    }
}
