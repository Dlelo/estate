package com.example.estate.dto;

import com.example.estate.model.Notification.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SendNotificationRequest {

    /** null = broadcast to ALL active users */
    private Long userId;

    @NotBlank
    private String title;

    @NotBlank
    private String message;

    @NotNull
    private NotificationType type;
}
