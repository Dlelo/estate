package com.example.estate.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.Set;

public record UpdateUserRolesRequest(

        @NotEmpty(message = "At least one role must be provided")
        Set<String> roles

) {}
