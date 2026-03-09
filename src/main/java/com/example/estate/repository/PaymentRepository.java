package com.example.estate.repository;

import com.example.estate.model.Payment;
import com.example.estate.model.User;
import com.example.estate.model.Contribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    // 🔹 All payments by user
    List<Payment> findByUser(User user);

    // 🔹 All payments for a contribution
    List<Payment> findByContribution(Contribution contribution);

    // 🔹 Total paid by user
    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM Payment p
            WHERE p.user = :user
           """)
    BigDecimal getTotalPaidByUser(User user);

    // 🔹 Estate-wide total collected
    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM Payment p
           """)
    BigDecimal getTotalCollected();

}
