package com.example.estate.dto;

import jakarta.validation.constraints.NotBlank;

public record RoleRequestDTO(
        @NotBlank String name,
        String description
) {}