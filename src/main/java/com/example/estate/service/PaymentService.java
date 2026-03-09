package com.example.estate.service;

import com.example.estate.model.*;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final ContributionRepository contributionRepository;

    public Payment makePayment(
            Long contributionId,
            BigDecimal amount,
            PaymentMethod method,
            String reference
    ) {

        Contribution contribution = contributionRepository.findById(contributionId)
                .orElseThrow(() -> new RuntimeException("Contribution not found"));

        if (contribution.getBalance().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Contribution already settled");
        }

        if (amount.compareTo(contribution.getBalance()) > 0) {
            throw new RuntimeException("Payment exceeds balance");
        }

        // Create payment
        Payment payment = Payment.builder()
                .user(contribution.getUser())
                .contribution(contribution)
                .amount(amount)
                .method(method)
                .transactionReference(reference)
                .build();

        paymentRepository.save(payment);
        
        BigDecimal newPaid = contribution.getPaidAmount().add(amount);
        BigDecimal newBalance = contribution.getAmount().subtract(newPaid);

        contribution.setPaidAmount(newPaid);
        contribution.setBalance(newBalance);
        contribution.setSettled(newBalance.compareTo(BigDecimal.ZERO) == 0);

        contributionRepository.save(contribution);

        return payment;
    }
}
