package com.example.estate.model;
import com.example.estate.enums.ContributionFrequency;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "contribution_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContributionType extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String name; // Service Fee, Garbage, Security

    @Column(nullable = false)
    private BigDecimal amount;

    // VARCHAR, not a native MySQL ENUM — see Payment.method for why.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "VARCHAR(30)")
    private ContributionFrequency frequency;

    /** Day of month (1-31) contributions of this type are due. Null = due date not tracked. */
    private Integer dueDay;

    @Builder.Default
    private Boolean active = true;
}
