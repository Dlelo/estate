package com.example.estate.enums;

public enum PaymentStatus {
    PENDING,
    COMPLETED,
    FAILED,
    CANCELLED,
    /** No callback and no definitive STK query result arrived within the reconciliation window. */
    TIMEOUT
}
