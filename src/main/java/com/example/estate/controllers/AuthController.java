package com.example.estate.controllers;

import com.example.estate.dto.*;
import com.example.estate.model.Role;
import com.example.estate.model.User;
import com.example.estate.repository.RoleRepository;
import com.example.estate.repository.UserRepository;
import com.example.estate.security.JwtUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;

    @PostMapping("/register")
    public void register(@Valid @RequestBody RegisterRequest request) {

        if (userRepository.findByPhoneNumber(request.getPhoneNumber()).isPresent()) {
            throw new IllegalStateException("Phone number already registered");
        }

        String fullName = request.getFirstName() + " " + request.getLastName();

        Role memberRole = roleRepository.findByName("MEMBER")
                .orElseThrow(() -> new IllegalStateException("Default MEMBER role not found"));

        Set<Role> roles = new HashSet<>();
        roles.add(memberRole);

        User user = User.builder()
                .fullName(fullName)
                .phoneNumber(request.getPhoneNumber())
                .password(passwordEncoder.encode(request.getPassword()))
                .roles(roles)
                .active(true)
                .build();

        userRepository.save(user);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.phoneNumber(),
                        request.password()
                )
        );


        User user = userRepository
                .findByPhoneNumber(request.phoneNumber())
                .orElseThrow(() -> new IllegalStateException("User not found"));

        String roleNames = user.getRoles()
                .stream()
                .map(Role::getName)
                .reduce((r1, r2) -> r1 + "," + r2)
                .orElse("");

        String token = jwtUtil.generateToken(user.getPhoneNumber(), roleNames);

        return new AuthResponse(token);
    }
}
