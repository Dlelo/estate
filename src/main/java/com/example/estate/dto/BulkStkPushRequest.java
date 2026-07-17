package com.example.estate.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record BulkStkPushRequest(

        @NotEmpty(message = "At least one contribution must be selected")
        List<Long> contributionIds,

        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "^(2547|07|7)\\d{8}$", message = "Enter a valid Kenyan phone number")
        String phoneNumber
) {}
