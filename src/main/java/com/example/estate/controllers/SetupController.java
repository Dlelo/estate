package com.example.estate.controllers;

import com.example.estate.model.Role;
import com.example.estate.model.User;
import com.example.estate.repository.RoleRepository;
import com.example.estate.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * One-time bootstrap endpoint — only works when NO admin exists.
 * Promotes the given userId to ADMIN. Disable or delete once set up.
 */
@RestController
@RequestMapping("/api/setup")
@RequiredArgsConstructor
public class SetupController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    @PostMapping("/make-admin/{userId}")
    public ResponseEntity<Map<String, String>> makeAdmin(@PathVariable Long userId) {
        // Guard: only allowed when no admin exists yet
        boolean adminExists = userRepository.findAll().stream()
                .anyMatch(u -> u.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getName())));

        if (adminExists) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "An admin already exists. Use the admin panel to manage roles."));
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseThrow(() -> new RuntimeException("ADMIN role not found"));

        user.getRoles().add(adminRole);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "User '" + user.getFullName() + "' promoted to ADMIN",
                "userId", String.valueOf(user.getId())
        ));
    }
}
