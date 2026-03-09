package com.example.estate.controllers;

import com.example.estate.model.Contribution;
import com.example.estate.repository.ContributionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private final ContributionRepository contributionRepository;

    @GetMapping("/total-outstanding")
    public BigDecimal totalOutstanding() {
        return contributionRepository.getTotalOutstanding();
    }

    @GetMapping("/unsettled")
    public List<Contribution> unsettledContributions() {
        return contributionRepository.findBySettledFalse();
    }

    @GetMapping("/summary")
    public Map<String, Object> getEstateSummary() {
        return Map.of(
                "totalCollected", contributionRepository.getTotalCollected(),
                "totalOutstanding", contributionRepository.getTotalOutstanding(),
                "unpaidCount", contributionRepository.countBySettledFalse()
        );
    }
}
