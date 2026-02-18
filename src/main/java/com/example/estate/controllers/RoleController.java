package com.example.estate.controllers;

import com.example.estate.dto.RoleRequestDTO;
import com.example.estate.dto.RoleResponseDTO;
import com.example.estate.model.Role;
import com.example.estate.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
@Validated
public class RoleController {

    private final RoleService roleService;

    @PostMapping
    public ResponseEntity<RoleResponseDTO> createRole(
            @Valid @RequestBody RoleRequestDTO request) {

        Role role = Role.builder()
                .name(request.name().toUpperCase())
                .description(request.description())
                .build();

        RoleResponseDTO saved = roleService.createRole(role);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{roleId}")
    public ResponseEntity<Void> deleteRole(@PathVariable Long roleId) {
        roleService.deleteRole(roleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<RoleResponseDTO>> getAllRoles() {
        return ResponseEntity.ok(roleService.getAllRoles());
    }
}
