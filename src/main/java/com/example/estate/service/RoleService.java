package com.example.estate.service;

import com.example.estate.dto.RoleResponseDTO;
import com.example.estate.model.Role;
import com.example.estate.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;

    public RoleResponseDTO createRole(Role role) {

        if (roleRepository.existsByName(role.getName())) {
            throw new IllegalArgumentException("Role already exists");
        }

        Role saved = roleRepository.save(role);

        return mapToDTO(saved);
    }

    public void deleteRole(Long roleId) {
        roleRepository.deleteById(roleId);
    }

    public List<RoleResponseDTO> getAllRoles() {
        return roleRepository.findAll()
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    private RoleResponseDTO mapToDTO(Role role) {
        return new RoleResponseDTO(
                role.getId(),
                role.getName(),
                role.getDescription()
        );
    }
}
