package com.example.estate.model;

import com.example.estate.enums.PaymentMethod;
import com.example.estate.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "payments", indexes = @Index(name = "idx_payment_checkout_request_id", columnList = "checkoutRequestId"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @ManyToOne(optional = false)
    private User user;

    @ManyToOne(optional = false)
    private Contribution contribution;

    @Column(nullable = false)
    private BigDecimal amount;

    // Stored as VARCHAR, not a native MySQL ENUM — ddl-auto=update never widens an existing
    // ENUM column's allowed values when a new Java enum constant is added, which breaks every
    // insert of the new value against an already-created database (hit this firsthand adding
    // PaymentMethod.PAYBILL). A VARCHAR needs no schema change to accept new enum constants.
    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "VARCHAR(30)")
    private PaymentMethod method;

    private String transactionReference; // mpesa receipt or bank ref

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "VARCHAR(30)")
    @Builder.Default
    private PaymentStatus status = PaymentStatus.PENDING;

    // Safaricom Daraja correlation IDs (STK push only). Not unique: a single bulk STK
    // push shares one checkoutRequestId across several Payment rows (one per contribution).
    private String merchantRequestId;

    private String checkoutRequestId;

    // Populated on FAILED/CANCELLED from Safaricom's ResultDesc
    private String resultDesc;

    // Raw callback JSON body, stored for audit trail
    @Column(columnDefinition = "TEXT")
    private String rawCallback;
}
