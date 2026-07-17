package com.example.estate.controllers;

import com.example.estate.dto.MpesaStkCallbackRequest;
import com.example.estate.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mpesa")
@RequiredArgsConstructor
public class MpesaCallbackController {

    private final PaymentService paymentService;

    /**
     * Safaricom's Daraja callback for STK push results. Always acknowledges with
     * 200 {"ResultCode":0} regardless of internal outcome — a non-200 response
     * or unexpected body makes Safaricom retry the callback, and our own
     * idempotency handling (see PaymentService.handleStkCallback) is what
     * makes retries safe, not this response.
     */
    @PostMapping("/callback")
    public Map<String, Object> mpesaCallback(@RequestBody MpesaStkCallbackRequest request) {
        try {
            paymentService.handleStkCallback(request, request.toString());
        } catch (Exception e) {
            log.error("Error processing M-Pesa callback: {}", request, e);
        }
        return Map.of("ResultCode", 0, "ResultDesc", "Accepted");
    }
}
