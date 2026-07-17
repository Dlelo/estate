package com.example.estate.controllers;

import com.example.estate.dto.StatementEntryDTO;
import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.Contribution;
import com.example.estate.model.Payment;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.PaymentRepository;
import com.example.estate.service.StatementService;
import com.example.estate.specification.ContributionSpecification;
import com.example.estate.specification.PaymentSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private final ContributionRepository contributionRepository;
    private final PaymentRepository paymentRepository;
    private final StatementService statementService;

    @GetMapping("/total-outstanding")
    public BigDecimal totalOutstanding() {
        return contributionRepository.getTotalOutstanding();
    }

    @GetMapping("/unsettled")
    public List<Contribution> unsettledContributions() {
        return contributionRepository.findBySettledFalse();
    }

    /** Contributions filterable by settled state (paid vs unpaid), period, and due-date range —
     *  the general-purpose successor to /unsettled, which only ever showed unpaid contributions. */
    @GetMapping("/contributions")
    public List<Contribution> getContributions(
            @RequestParam(required = false) Boolean settled,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        Specification<Contribution> spec = Specification
                .where(ContributionSpecification.hasSettled(settled))
                .and(ContributionSpecification.hasPeriod(period))
                .and(ContributionSpecification.dueBetween(from, to));
        return contributionRepository.findAll(spec);
    }

    @GetMapping("/summary")
    public Map<String, Object> getEstateSummary() {
        return Map.of(
                "totalCollected", contributionRepository.getTotalCollected(),
                "totalOutstanding", contributionRepository.getTotalOutstanding(),
                // Contribution-level: charges still owed (independent of whether a payment attempt exists)
                "unpaidCount", contributionRepository.countBySettledFalse(),
                // Reconciling metric: of the unpaid contributions above, how many already have an
                // M-Pesa STK push awaiting confirmation — explains why this can differ from the
                // Payment-level "pending" count shown in Payment Activity (which counts attempts, not contributions)
                "unpaidWithPendingPaymentCount", contributionRepository.countUnpaidWithPendingPayment()
        );
    }

    /** Payment attempts (PENDING/COMPLETED/FAILED/CANCELLED), filterable by status and date range. */
    @GetMapping("/payments")
    public Page<Payment> getPayments(
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Specification<Payment> spec = Specification
                .where(PaymentSpecification.hasStatus(status))
                .and(PaymentSpecification.createdBetween(startOfDay(from), endOfDay(to)));

        Pageable pageable = PageRequest.of(page, size);
        return paymentRepository.findAll(spec, pageable);
    }

    /** Totals (count + sum) per payment status, for an optional date range — independent of any status filter. */
    @GetMapping("/payments/totals")
    public Map<String, Map<String, Object>> getPaymentTotals(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        Map<String, Map<String, Object>> totals = new java.util.LinkedHashMap<>();
        for (PaymentStatus status : PaymentStatus.values()) {
            totals.put(status.name(), Map.of("count", 0L, "total", BigDecimal.ZERO));
        }
        for (PaymentRepository.PaymentStatusTotal row : paymentRepository.getTotalsByStatusAndDateRange(startOfDay(from), endOfDay(to))) {
            totals.put(row.getStatus().name(), Map.of("count", row.getCount(), "total", row.getTotal()));
        }
        return totals;
    }

    /** Full chronological ledger (charges + payment events) with running balance, for one member. */
    @GetMapping("/members/{userId}/statement")
    public List<StatementEntryDTO> getMemberStatement(
            @PathVariable Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return statementService.buildStatement(userId, from, to);
    }

    private LocalDateTime startOfDay(LocalDate date) {
        return date == null ? null : date.atStartOfDay();
    }

    private LocalDateTime endOfDay(LocalDate date) {
        return date == null ? null : date.atTime(23, 59, 59);
    }
}
