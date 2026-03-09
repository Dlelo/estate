package com.example.estate.controllers;

import com.example.estate.model.*;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/contributions")
@RequiredArgsConstructor
public class ContributionController {

    private final ContributionService contributionService;
    private final PaymentService paymentService;

    @GetMapping("/user/{userId}")
    public List<Contribution> getUserContributions(@PathVariable Long userId) {
        return contributionService.getUserContributions(userId);
    }

    @PostMapping("/{id}/pay")
    public Payment payContribution(
            @PathVariable Long id,
            @RequestParam BigDecimal amount,
            @RequestParam PaymentMethod method,
            @RequestParam String reference
    ) {
        return paymentService.makePayment(id, amount, method, reference);
    }
}
