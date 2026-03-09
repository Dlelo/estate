package com.example.estate.repository;

import com.example.estate.model.Contribution;
import com.example.estate.model.ContributionType;
import com.example.estate.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface ContributionRepository extends JpaRepository<Contribution, Long> {

    // 🔹 Used by Monthly Scheduler
    boolean existsByUserAndContributionTypeAndPeriod(
            User user,
            ContributionType contributionType,
            String period
    );

    // 🔹 Get contributions per user
    List<Contribution> findByUser(User user);

    Page<Contribution> findByUser(User user, Pageable pageable);

    // 🔹 Get by user + period
    List<Contribution> findByUserAndPeriod(User user, String period);

    // 🔹 Get unsettled contributions
    List<Contribution> findByUserAndSettledFalse(User user);

    // 🔹 Find by id and user (security safe)
    Optional<Contribution> findByIdAndUser(Long id, User user);

    List<Contribution> findBySettledFalse();

    // ==========================
    // 📊 ENTERPRISE REPORTING
    // ==========================

    // 🔹 Total outstanding balance per user
    @Query("""
            SELECT COALESCE(SUM(c.balance), 0)
            FROM Contribution c
            WHERE c.user = :user AND c.settled = false
           """)
    BigDecimal getTotalOutstandingBalance(User user);

    // 🔹 Total paid per user
    @Query("""
            SELECT COALESCE(SUM(c.paidAmount), 0)
            FROM Contribution c
            WHERE c.user = :user
           """)
    BigDecimal getTotalPaidByUser(User user);

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

}
