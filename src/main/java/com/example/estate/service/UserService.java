package com.example.estate.service;

import com.example.estate.dto.UpdateUserRequest;
import com.example.estate.dto.UpdateUserRolesRequest;
import com.example.estate.model.Role;
import com.example.estate.model.User;
import com.example.estate.repository.RoleRepository;
import com.example.estate.repository.UserRepository;
import com.example.estate.specification.UserSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    // ✅ Search + Filter + Pagination + Sorting
    @Transactional(readOnly = true)
    public Page<User> searchUsers(
            String name,
            String phone,
            Boolean active,
            Pageable pageable
    ) {

        Specification<User> spec = Specification
                .where(UserSpecification.hasFullName(name))
                .and(UserSpecification.hasPhone(phone))
                .and(UserSpecification.isActive(active))
                .and(UserSpecification.isNotDeleted());

        return userRepository.findAll(spec, pageable);
    }

    // ✅ Update basic user info
    public User updateUser(Long userId, UpdateUserRequest request) {

        User user = getUserOrThrow(userId);

        user.setFullName(request.fullName());
        user.setHouseNumber(request.houseNumber());

        if (request.active() != null) {
            user.setActive(request.active());
        }

        return userRepository.save(user);
    }

    // ✅ Admin: Update user roles
    public User updateUserRoles(Long userId, UpdateUserRolesRequest request) {

        User user = getUserOrThrow(userId);

        Set<Role> roles = request.roles()
                .stream()
                .map(roleName -> roleRepository.findByName(roleName)
                        .orElseThrow(() ->
                                new IllegalStateException("Role not found: " + roleName)))
                .collect(Collectors.toSet());

        user.setRoles(roles);

        return userRepository.save(user);
    }

    // ✅ Soft delete
    public void deleteUser(Long userId) {
        User user = getUserOrThrow(userId);
        user.setDeleted(true);
    }

    private User getUserOrThrow(Long id) {
        return userRepository.findById(id)
                .filter(user -> !Boolean.TRUE.equals(user.getDeleted()))
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}
