package com.example.estate.service;

import com.example.estate.dto.UpdateSelfRequest;
import com.example.estate.model.User;
import com.example.estate.repository.RoleRepository;
import com.example.estate.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;

    private UserService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new UserService(userRepository, roleRepository);
        user = User.builder().fullName("Old Name").phoneNumber("0712345678")
                .password("hash").active(true).houseNumber("A1").build();
        user.setId(1L);
    }

    @Test
    void updateSelf_updatesNameAndHouseNumber_butNotActiveOrPhone() {
        when(userRepository.findByPhoneNumber("0712345678")).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User updated = service.updateSelf("0712345678", new UpdateSelfRequest("New Name", "B2", "jane@example.com"));

        assertThat(updated.getFullName()).isEqualTo("New Name");
        assertThat(updated.getHouseNumber()).isEqualTo("B2");
        assertThat(updated.getEmail()).isEqualTo("jane@example.com");
        assertThat(updated.getActive()).isTrue();
        assertThat(updated.getPhoneNumber()).isEqualTo("0712345678");
    }

    @Test
    void updateSelf_throwsWhenUserNotFound() {
        when(userRepository.findByPhoneNumber("0700000000")).thenReturn(Optional.empty());

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> service.updateSelf("0700000000", new UpdateSelfRequest("X", null, null)));
    }
}
