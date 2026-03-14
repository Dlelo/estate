package com.example.estate.dto;

import com.example.estate.enums.ContributionFrequency;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ContributionTypeRequest {

    @NotBlank
    private String name;

    @NotNull
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull
    private ContributionFrequency frequency;

    private String description;
}
