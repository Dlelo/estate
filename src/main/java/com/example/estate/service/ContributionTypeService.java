package com.example.estate.service;

import com.example.estate.dto.ContributionTypeRequest;
import com.example.estate.model.ContributionType;
import com.example.estate.repository.ContributionTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ContributionTypeService {

    private final ContributionTypeRepository repository;

    public List<ContributionType> getAll() {
        return repository.findAll();
    }

    public List<ContributionType> getAllActive() {
        return repository.findByActiveTrue();
    }

    public ContributionType create(ContributionTypeRequest req) {
        if (repository.findByName(req.getName()).isPresent()) {
            throw new IllegalStateException("Contribution type '" + req.getName() + "' already exists");
        }
        ContributionType type = ContributionType.builder()
                .name(req.getName())
                .amount(req.getAmount())
                .frequency(req.getFrequency())
                .active(true)
                .build();
        return repository.save(type);
    }

    public ContributionType update(Long id, ContributionTypeRequest req) {
        ContributionType type = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));

        // Allow rename only if new name doesn't conflict
        if (!type.getName().equals(req.getName()) && repository.findByName(req.getName()).isPresent()) {
            throw new IllegalStateException("Name '" + req.getName() + "' is already taken");
        }

        type.setName(req.getName());
        type.setAmount(req.getAmount());
        type.setFrequency(req.getFrequency());
        return repository.save(type);
    }

    public void toggleActive(Long id) {
        ContributionType type = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));
        type.setActive(!type.getActive());
        repository.save(type);
    }

    public void delete(Long id) {
        ContributionType type = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution type not found"));
        type.setDeleted(true);
        type.setActive(false);
        repository.save(type);
    }
}
