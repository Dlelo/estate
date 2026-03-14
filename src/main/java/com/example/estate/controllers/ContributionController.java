package com.example.estate.controllers;

import com.example.estate.model.*;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/contributions")
@RequiredArgsConstructor
public class ContributionController {

    private final ContributionService contributionService;
    private final PaymentService paymentService;

    /** All contributions for a user */
    @GetMapping("/user/{userId}")
    public List<Contribution> getUserContributions(@PathVariable Long userId) {
        return contributionService.getUserContributions(userId);
    }

    /** Pending (unsettled) contributions for a user */
    @GetMapping("/user/{userId}/pending")
    public List<Contribution> getPendingContributions(@PathVariable Long userId) {
        return contributionService.getPendingContributions(userId);
    }

    @PostMapping("/{id}/pay")
    public Payment payContribution(
            @PathVariable Long id,
            @RequestParam BigDecimal amount,
            @RequestParam PaymentMethod method,
            @RequestParam(required = false) String reference
    ) {
        return paymentService.makePayment(id, amount, method, reference);
    }

    /** Admin: manually generate contributions for a given period */
    @PostMapping("/admin/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public String generateForPeriod(@RequestParam String period) {
        contributionService.generateContributionsForPeriod(period);
        return "Contributions generated for period: " + period;
    }
}
