package com.example.estate.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record StkPushRequest(

        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "^(2547|07|7)\\d{8}$", message = "Enter a valid Kenyan phone number")
        String phoneNumber
) {}
