package com.example.estate.service;

import com.example.estate.model.*;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.example.estate.dto.BulkPaymentRequest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

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

    public List<Payment> bulkPay(BulkPaymentRequest req) {
        List<Payment> payments = new ArrayList<>();
        for (Long id : req.getIds()) {
            Contribution c = contributionRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Contribution not found: " + id));
            if (Boolean.FALSE.equals(c.getSettled())) {
                payments.add(makePayment(id, c.getBalance(), req.getMethod(), req.getReference()));
            }
        }
        return payments;
    }
}
