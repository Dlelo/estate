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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ContributionFrequency frequency;

    @Builder.Default
    private Boolean active = true;
}
