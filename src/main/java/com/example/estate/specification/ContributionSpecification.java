package com.example.estate.specification;

import com.example.estate.model.Contribution;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;

public class ContributionSpecification {

    public static Specification<Contribution> hasSettled(Boolean settled) {
        return (root, query, cb) ->
                settled == null ? null : cb.equal(root.get("settled"), settled);
    }

    public static Specification<Contribution> hasPeriod(String period) {
        return (root, query, cb) ->
                (period == null || period.isBlank()) ? null : cb.equal(root.get("period"), period);
    }

    public static Specification<Contribution> dueBetween(LocalDate from, LocalDate to) {
        return (root, query, cb) -> {
            if (from == null && to == null) return null;
            if (from != null && to != null) return cb.between(root.get("dueDate"), from, to);
            if (from != null) return cb.greaterThanOrEqualTo(root.get("dueDate"), from);
            return cb.lessThanOrEqualTo(root.get("dueDate"), to);
        };
    }
}
