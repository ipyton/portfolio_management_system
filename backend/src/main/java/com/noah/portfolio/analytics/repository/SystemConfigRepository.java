package com.noah.portfolio.analytics.repository;

import com.noah.portfolio.analytics.controller.*;
import com.noah.portfolio.analytics.entity.*;
import com.noah.portfolio.analytics.service.*;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemConfigRepository extends JpaRepository<SystemConfigEntity, Long> {

    Optional<SystemConfigEntity> findByConfigKey(String configKey);
}
