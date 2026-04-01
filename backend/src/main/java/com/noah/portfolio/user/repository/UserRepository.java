package com.noah.portfolio.user.repository;

import com.noah.portfolio.user.entity.*;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findFirstByOrderByIdAsc();
}
