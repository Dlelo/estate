package com.example.estate.enums;

public enum PaymentMethod {
    /** System-initiated STK push only — tracked via checkoutRequestId, resolved by callback.
     *  Never accepted for manual entry (see PaymentService.makePayment). */
    MPESA,
    /** Member paid via M-Pesa Paybill on their own (outside the app's STK push flow) and is
     *  manually recording the confirmation code they received. */
    PAYBILL,
    BANK,
    CREDIT_CARD
}
