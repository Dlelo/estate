package com.example.estate.repository;

import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.ContributionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContributionTypeRepository extends JpaRepository<ContributionType, Long> {

    // Used by MonthlyContributionScheduler
    List<ContributionType> findByFrequency(ContributionFrequency frequency);

    Optional<ContributionType> findByName(String name);

    List<ContributionType> findByActiveTrue();

}
