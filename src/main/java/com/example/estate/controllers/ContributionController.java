package com.example.estate.controllers;

import com.example.estate.dto.BulkPaymentRequest;
import com.example.estate.dto.BulkStkPushRequest;
import com.example.estate.dto.StkPushRequest;
import com.example.estate.dto.StkPushResponse;
import com.example.estate.model.*;
import com.example.estate.enums.PaymentMethod;
import com.example.estate.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/contributions")
@RequiredArgsConstructor
public class ContributionController {

    private final ContributionService contributionService;
    private final PaymentService paymentService;

    /** All contributions for a user */
    @GetMapping("/user/{userId}")
    public List<Contribution> getUserContributions(@PathVariable Long userId) {
        return contributionService.getUserContributions(userId);
    }

    /** Pending (unsettled) contributions for a user */
    @GetMapping("/user/{userId}/pending")
    public List<Contribution> getPendingContributions(@PathVariable Long userId) {
        return contributionService.getPendingContributions(userId);
    }

    @PostMapping("/{id}/pay")
    public Payment payContribution(
            @PathVariable Long id,
            @RequestParam BigDecimal amount,
            @RequestParam PaymentMethod method,
            @RequestParam(required = false) String reference
    ) {
        return paymentService.makePayment(id, amount, method, reference);
    }

    /** User: pay multiple contributions at once (quarterly / annual bulk) */
    @PostMapping("/bulk-pay")
    public List<Payment> bulkPay(@RequestBody BulkPaymentRequest req) {
        return paymentService.bulkPay(req);
    }

    /** Initiate an M-Pesa STK push for a single contribution's outstanding balance */
    @PostMapping("/{id}/stk-push")
    public StkPushResponse stkPush(@PathVariable Long id, @Valid @RequestBody StkPushRequest request) {
        return paymentService.initiateStkPush(id, request.phoneNumber());
    }

    /** Initiate one M-Pesa STK push covering several contributions' combined balance */
    @PostMapping("/bulk-stk-push")
    public StkPushResponse bulkStkPush(@Valid @RequestBody BulkStkPushRequest request) {
        return paymentService.initiateBulkStkPush(request.contributionIds(), request.phoneNumber());
    }

    /** Admin: manually generate contributions for a given period. Returns the rows actually
     *  created so the UI can show exactly what happened, not just a count. */
    @PostMapping("/admin/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public java.util.Map<String, Object> generateForPeriod(@RequestParam String period) {
        List<Contribution> created = contributionService.generateContributionsForPeriod(period);
        return java.util.Map.of("period", period, "count", created.size(), "contributions", created);
    }
}
