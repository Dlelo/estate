package com.example.estate.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record StatementEntryDTO(
        LocalDateTime date,
        String type,               // "CHARGE" | "PAYMENT"
        String description,
        LocalDate dueDate,
        BigDecimal debit,
        BigDecimal credit,
        BigDecimal runningBalance,
        String method,
        String transactionReference,
        String status,
        String notes
) {}
