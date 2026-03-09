package com.example.estate.controllers;

import com.example.estate.dto.MpesaCallbackRequest;
import com.example.estate.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/mpesa")
@RequiredArgsConstructor
public class MpesaCallbackController {

    private final PaymentService paymentService;

    @PostMapping("/callback")
    public String mpesaCallback(@RequestBody MpesaCallbackRequest request) {
        
        Long contributionId = request.getContributionId();
        BigDecimal amount = request.getAmount();
        String mpesaCode = request.getMpesaCode();

        paymentService.makePayment(
                contributionId,
                amount,
                com.example.estate.enums.PaymentMethod.MPESA,
                mpesaCode
        );

        return "Callback received successfully";
    }
}
