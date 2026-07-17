package com.example.estate.repository;

import com.example.estate.model.Contribution;
import com.example.estate.model.ContributionType;
import com.example.estate.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface ContributionRepository extends JpaRepository<Contribution, Long>, JpaSpecificationExecutor<Contribution> {

    // 🔹 Used by Monthly Scheduler
    boolean existsByUserAndContributionTypeAndPeriod(
            User user,
            ContributionType contributionType,
            String period
    );

    // 🔹 Used for ONE_TIME types: existence is period-independent (generate at most once ever)
    boolean existsByUserAndContributionType(
            User user,
            ContributionType contributionType
    );

    // 🔹 Get contributions per user
    List<Contribution> findByUser(User user);

    // 🔹 Reminder batch: all unsettled contributions for a period in one query (avoids N+1 per user)
    List<Contribution> findByPeriodAndSettledFalse(String period);

    // 🔹 Get unsettled contributions
    List<Contribution> findByUserAndSettledFalse(User user);

    List<Contribution> findBySettledFalse();

    // 🔹 Reminder scheduler: unsettled contributions due on an exact date (before/on/after-due offsets)
    List<Contribution> findBySettledFalseAndDueDate(LocalDate dueDate);

    // ==========================
    // 📊 ENTERPRISE REPORTING
    // ==========================

    // 🔹 Estate-wide total collected
    @Query("""
            SELECT COALESCE(SUM(c.paidAmount), 0)
            FROM Contribution c
           """)
    BigDecimal getTotalCollected();

    // 🔹 Estate-wide outstanding
    @Query("""
            SELECT COALESCE(SUM(c.balance), 0)
            FROM Contribution c
            WHERE c.settled = false
           """)
    BigDecimal getTotalOutstanding();

    // 🔹 Count unpaid contributions
    long countBySettledFalse();

    // 🔹 Reconciling metric between the Contribution-level "unpaid" count and the Payment-level
    // "pending" count shown side by side on the dashboard: how many of the unpaid contributions
    // already have an M-Pesa STK push in flight (as opposed to no payment attempted at all yet)?
    @Query("""
            SELECT COUNT(DISTINCT c)
            FROM Contribution c JOIN Payment p ON p.contribution = c
            WHERE c.settled = false AND p.status = 'PENDING'
           """)
    long countUnpaidWithPendingPayment();

}
