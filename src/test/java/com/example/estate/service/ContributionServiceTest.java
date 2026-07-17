package com.example.estate.service;

import com.example.estate.enums.ContributionFrequency;
import com.example.estate.model.Contribution;
import com.example.estate.model.ContributionType;
import com.example.estate.model.User;
import com.example.estate.repository.ContributionRepository;
import com.example.estate.repository.ContributionTypeRepository;
import com.example.estate.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContributionServiceTest {

    @Mock private ContributionRepository contributionRepository;
    @Mock private ContributionTypeRepository contributionTypeRepository;
    @Mock private UserRepository userRepository;

    private ContributionService service;
    private User user;
    private ContributionType oneTimeType;
    private ContributionType monthlyType;

    @BeforeEach
    void setUp() {
        service = new ContributionService(contributionRepository, contributionTypeRepository, userRepository);

        user = User.builder().fullName("Jane Doe").phoneNumber("0712345678")
                .password("hash").active(true).build();
        user.setId(1L);

        oneTimeType = ContributionType.builder().name("Development Levy")
                .amount(BigDecimal.valueOf(5000)).frequency(ContributionFrequency.ONE_TIME).active(true).build();
        oneTimeType.setId(1L);

        monthlyType = ContributionType.builder().name("Service Fee")
                .amount(BigDecimal.valueOf(1000)).frequency(ContributionFrequency.MONTHLY).active(true).build();
        monthlyType.setId(2L);

        when(userRepository.findAll()).thenReturn(List.of(user));
    }

    @Test
    void oneTimeContribution_isNotRegeneratedForANewPeriod() {
        when(contributionTypeRepository.findByFrequency(ContributionFrequency.MONTHLY)).thenReturn(List.of());
        when(contributionTypeRepository.findByFrequency(ContributionFrequency.ANNUAL)).thenReturn(List.of());
        when(contributionTypeRepository.findByFrequency(ContributionFrequency.ONE_TIME)).thenReturn(List.of(oneTimeType));

        // First period: not generated yet -> should create
        when(contributionRepository.existsByUserAndContributionType(user, oneTimeType)).thenReturn(false);
        List<Contribution> firstResult = service.generateContributionsForPeriod("2026-07");
        assertThat(firstResult).hasSize(1);
        verify(contributionRepository, times(1)).save(any(Contribution.class));

        // Second period: already exists (regardless of period) -> should NOT create again
        reset(contributionRepository);
        when(contributionRepository.existsByUserAndContributionType(user, oneTimeType)).thenReturn(true);
        List<Contribution> secondResult = service.generateContributionsForPeriod("2026-08");
        assertThat(secondResult).isEmpty();
        verify(contributionRepository, never()).save(any(Contribution.class));
    }

    @Test
    void monthlyContribution_isGeneratedOncePerDistinctPeriod() {
        when(contributionTypeRepository.findByFrequency(ContributionFrequency.MONTHLY)).thenReturn(List.of(monthlyType));
        when(contributionTypeRepository.findByFrequency(ContributionFrequency.ANNUAL)).thenReturn(List.of());
        when(contributionTypeRepository.findByFrequency(ContributionFrequency.ONE_TIME)).thenReturn(List.of());

        when(contributionRepository.existsByUserAndContributionTypeAndPeriod(user, monthlyType, "2026-07")).thenReturn(false);
        List<Contribution> julyResult = service.generateContributionsForPeriod("2026-07");
        assertThat(julyResult).hasSize(1);

        when(contributionRepository.existsByUserAndContributionTypeAndPeriod(user, monthlyType, "2026-08")).thenReturn(false);
        List<Contribution> augustResult = service.generateContributionsForPeriod("2026-08");
        assertThat(augustResult).hasSize(1);
    }
}
