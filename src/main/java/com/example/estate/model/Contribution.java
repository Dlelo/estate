package com.example.estate.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "contributions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contribution extends BaseEntity {

    @ManyToOne(optional = false)
    private User user;

    @ManyToOne(optional = false)
    private ContributionType contributionType;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private BigDecimal paidAmount;

    @Column(nullable = false)
    private BigDecimal balance;

    private String period; // e.g. "2026-01" (YearMonth)

    /** Computed at generation time from ContributionType.dueDay; null if not tracked. */
    private LocalDate dueDate;

    @Builder.Default
    private Boolean settled = false;
}
