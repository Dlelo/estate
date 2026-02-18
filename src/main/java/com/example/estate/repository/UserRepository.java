package com.example.estate.repository;

import com.example.estate.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> ,
        JpaSpecificationExecutor<User> {

    Optional<User> findByPhoneNumber(String phoneNumber);
}
