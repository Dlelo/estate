package com.example.estate.config;

import com.example.estate.model.Role;
import com.example.estate.model.User;
import com.example.estate.repository.RoleRepository;
import com.example.estate.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    @Override
    public void run(String... args) {
        createRoleIfMissing("MEMBER", "Default estate member");
        createRoleIfMissing("ADMIN",  "Estate administrator");
        promoteFirstUserIfNoAdmin();
    }

    private void createRoleIfMissing(String name, String description) {
        if (roleRepository.findByName(name).isEmpty()) {
            Role role = new Role();
            role.setName(name);
            role.setDescription(description);
            roleRepository.save(role);
            log.info("Created default role: {}", name);
        }
    }

    /**
     * If no user currently holds the ADMIN role, grant it to the first
     * registered user so there is always at least one admin to manage others.
     */
    private void promoteFirstUserIfNoAdmin() {
        Role adminRole = roleRepository.findByName("ADMIN").orElse(null);
        if (adminRole == null) return;

        boolean anyAdmin = userRepository.findAll().stream()
                .anyMatch(u -> u.getRoles().stream()
                        .anyMatch(r -> "ADMIN".equals(r.getName())));

        if (anyAdmin) return;

        List<User> users = userRepository.findAll();
        if (users.isEmpty()) return;

        User first = users.get(0);
        first.getRoles().add(adminRole);
        userRepository.save(first);
        log.warn("*** No admin found — promoted '{}' (id={}) to ADMIN ***",
                first.getFullName(), first.getId());
    }
}
