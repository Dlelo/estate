package com.example.estate.service;

import com.example.estate.model.*;
import com.example.estate.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

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

}
