package com.example.estate.service;

import com.example.estate.dto.StatementEntryDTO;
import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.Contribution;
import com.example.estate.model.Payment;
import com.example.estate.model.User;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.PaymentRepository;
import com.example.estate.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StatementService {

    private final UserRepository userRepository;
    private final ContributionRepository contributionRepository;
    private final PaymentRepository paymentRepository;

    /** Builds a chronological ledger (charges + payment events) with a running balance, for one member. */
    public List<StatementEntryDTO> buildStatement(Long userId, LocalDate from, LocalDate to) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<StatementEntryDTO> entries = new ArrayList<>();

        for (Contribution c : contributionRepository.findByUser(user)) {
            entries.add(new StatementEntryDTO(
                    c.getCreatedAt(), "CHARGE",
                    c.getContributionType().getName() + " (" + c.getPeriod() + ")",
                    c.getDueDate(), c.getAmount(), BigDecimal.ZERO, null,
                    null, null, null, null
            ));
        }

        for (Payment p : paymentRepository.findByUser(user)) {
            boolean completed = p.getStatus() == PaymentStatus.COMPLETED;
            String description = p.getContribution() != null
                    ? p.getContribution().getContributionType().getName() + " payment"
                    : "Payment";
            entries.add(new StatementEntryDTO(
                    p.getCreatedAt(), "PAYMENT", description, null,
                    BigDecimal.ZERO, completed ? p.getAmount() : BigDecimal.ZERO, null,
                    p.getMethod() != null ? p.getMethod().name() : null,
                    p.getTransactionReference(),
                    p.getStatus().name(),
                    completed ? null : p.getResultDesc()
            ));
        }

        entries.sort(Comparator.comparing(StatementEntryDTO::date));

        List<StatementEntryDTO> withRunningBalance = new ArrayList<>();
        BigDecimal running = BigDecimal.ZERO;
        for (StatementEntryDTO e : entries) {
            running = running.add(e.debit()).subtract(e.credit());
            withRunningBalance.add(new StatementEntryDTO(
                    e.date(), e.type(), e.description(), e.dueDate(),
                    e.debit(), e.credit(), running,
                    e.method(), e.transactionReference(), e.status(), e.notes()
            ));
        }

        return withRunningBalance.stream()
                .filter(e -> from == null || !e.date().toLocalDate().isBefore(from))
                .filter(e -> to == null || !e.date().toLocalDate().isAfter(to))
                .toList();
    }
}
