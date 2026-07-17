package com.example.estate.dto;

public record StkPushResponse(
        String checkoutRequestId,
        String merchantRequestId,
        String customerMessage
) {}
