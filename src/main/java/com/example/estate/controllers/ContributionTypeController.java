package com.example.estate.controllers;

import com.example.estate.dto.ContributionTypeRequest;
import com.example.estate.model.ContributionType;
import com.example.estate.service.ContributionTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contribution-types")
@RequiredArgsConstructor
public class ContributionTypeController {

    private final ContributionTypeService service;

    /** All authenticated users can view active types */
    @GetMapping
    public List<ContributionType> getAll() {
        return service.getAllActive();
    }

    /** Admin: see all including inactive */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ContributionType> getAllForAdmin() {
        return service.getAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ContributionType create(@Valid @RequestBody ContributionTypeRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ContributionType update(@PathVariable Long id,
                                   @Valid @RequestBody ContributionTypeRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public void toggleActive(@PathVariable Long id) {
        service.toggleActive(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
