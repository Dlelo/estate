package com.example.estate.service;

import com.example.estate.dto.ContributionTypeRequest;
import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.ContributionType;
import com.example.estate.repository.ContributionTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContributionTypeService {

    private final ContributionTypeRepository repository;

    // @Lazy breaks the circular dependency: ContributionService → ContributionTypeService
    @Lazy
    private final ContributionService contributionService;

    public List<ContributionType> getAll() {
        return repository.findAll();
    }

    public List<ContributionType> getAllActive() {
        return repository.findByActiveTrue();
    }

    public ContributionType create(ContributionTypeRequest req) {
        if (repository.findByName(req.getName()).isPresent()) {
            throw new IllegalStateException("Contribution type '" + req.getName() + "' already exists");
        }
        ContributionType type = ContributionType.builder()
                .name(req.getName())
                .amount(req.getAmount())
                .frequency(req.getFrequency())
                .active(true)
                .build();
        type = repository.save(type);

        // Immediately generate contribution records for all active members
        // so they see the new obligation right away without waiting for the scheduler.
        String period = buildCurrentPeriod(req.getFrequency());
        try {
            contributionService.generateContributionsForPeriod(period);
            log.info("Auto-generated contributions for new type '{}' period={}", type.getName(), period);
        } catch (Exception e) {
            log.warn("Could not auto-generate contributions for new type '{}': {}", type.getName(), e.getMessage());
        }

        return type;
    }

    public ContributionType update(Long id, ContributionTypeRequest req) {
        ContributionType type = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));

        // Allow rename only if new name doesn't conflict
        if (!type.getName().equals(req.getName()) && repository.findByName(req.getName()).isPresent()) {
            throw new IllegalStateException("Name '" + req.getName() + "' is already taken");
        }

        type.setName(req.getName());
        type.setAmount(req.getAmount());
        type.setFrequency(req.getFrequency());
        return repository.save(type);
    }

    public void toggleActive(Long id) {
        ContributionType type = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));
        type.setActive(!type.getActive());
        repository.save(type);
    }

    public void delete(Long id) {
        ContributionType type = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));
        type.setDeleted(true);
        type.setActive(false);
        repository.save(type);
    }

    /**
     * Returns the period string to use when auto-generating contributions:
     * - MONTHLY  → "YYYY-MM"  (current month)
     * - ANNUAL   → "YYYY"     (current year)
     * - ONE_TIME → "YYYY-MM"  (current month)
     */
    private String buildCurrentPeriod(ContributionFrequency frequency) {
        YearMonth now = YearMonth.now();
        if (frequency == ContributionFrequency.ANNUAL) {
            return String.valueOf(now.getYear());
        }
        return now.toString(); // e.g. "2026-03"
    }
}
