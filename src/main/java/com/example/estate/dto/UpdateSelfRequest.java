package com.example.estate.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateSelfRequest(

        @NotBlank(message = "Full name is required")
        @Size(max = 100, message = "Full name must not exceed 100 characters")
        String fullName,

        @Size(max = 20, message = "House number must not exceed 20 characters")
        String houseNumber,

        @Email(message = "Must be a valid email address")
        @Size(max = 150, message = "Email must not exceed 150 characters")
        String email
) {}
