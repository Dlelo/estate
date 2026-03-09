package com.example.estate.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class MpesaCallbackRequest {

    private Long contributionId;
    private BigDecimal amount;
    private String mpesaCode;
}
