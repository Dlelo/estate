package com.example.estate.dto;

import java.time.LocalDateTime;
import java.util.Set;

public record UserResponseDTO(

        Long id,
        String fullName,
        String phoneNumber,
        String houseNumber,
        Boolean active,
        Set<String> roles,

        // Audit fields (optional but recommended)
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String createdBy,
        String updatedBy

) {}
