package com.example.estate.controllers;

import com.example.estate.config.MpesaProperties;
import com.example.estate.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final MpesaProperties mpesaProperties;

    /** Frontend polls this while an STK push is pending resolution */
    @GetMapping("/status/{checkoutRequestId}")
    public Map<String, String> getStatus(@PathVariable String checkoutRequestId) {
        return Map.of("status", paymentService.getStatusByCheckoutRequestId(checkoutRequestId).name());
    }

    /** The estate's public paybill number, for members paying manually via M-Pesa's Pay Bill
     *  menu instead of the app-initiated STK push. Not a secret — it's printed on notices/signage. */
    @GetMapping("/paybill-info")
    public Map<String, String> getPaybillInfo() {
        return Map.of("paybillNumber", mpesaProperties.getShortcode());
    }
}
