package com.example.estate.repository;

import com.example.estate.enums.PaymentStatus;
import com.example.estate.model.Payment;
import com.example.estate.model.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    // 🔹 All payments by user
    List<Payment> findByUser(User user);

    // 🔹 STK push correlation lookups (idempotency). A bulk STK push shares one
    // checkoutRequestId across several rows, so this can legitimately return >1 result.
    List<Payment> findAllByCheckoutRequestId(String checkoutRequestId);

    // 🔹 Row-locks the payment(s) for a checkoutRequestId before a callback/reconciliation
    // job reads-then-writes their status, so two concurrent callback deliveries for the
    // same checkoutRequestId can't both observe PENDING and double-apply the payment.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.checkoutRequestId = :checkoutRequestId")
    List<Payment> findAllByCheckoutRequestIdForUpdate(@Param("checkoutRequestId") String checkoutRequestId);

    // 🔹 Reconciliation: STK pushes still PENDING after Safaricom's callback should have arrived
    List<Payment> findByStatusAndCreatedAtBefore(PaymentStatus status, LocalDateTime cutoff);

    // 🔹 Admin report: counts + totals grouped by status, for an optional date range
    @Query("""
            SELECT p.status AS status, COUNT(p) AS count, COALESCE(SUM(p.amount), 0) AS total
            FROM Payment p
            WHERE (:from IS NULL OR p.createdAt >= :from)
              AND (:to IS NULL OR p.createdAt <= :to)
            GROUP BY p.status
           """)
    List<PaymentStatusTotal> getTotalsByStatusAndDateRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface PaymentStatusTotal {
        com.example.estate.enums.PaymentStatus getStatus();
        long getCount();
        BigDecimal getTotal();
    }

}
