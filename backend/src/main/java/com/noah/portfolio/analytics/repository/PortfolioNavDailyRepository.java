package com.noah.portfolio.analytics.repository;

import com.noah.portfolio.analytics.controller.*;
import com.noah.portfolio.analytics.entity.*;
import com.noah.portfolio.analytics.service.*;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PortfolioNavDailyRepository extends JpaRepository<PortfolioNavDailyEntity, Long> {

    List<PortfolioNavDailyEntity> findByUser_IdOrderByNavDateAsc(Long userId);

    Optional<PortfolioNavDailyEntity> findByUser_IdAndNavDate(Long userId, java.time.LocalDate navDate);

    Optional<PortfolioNavDailyEntity> findTopByUser_IdAndNavDateLessThanOrderByNavDateDesc(Long userId, java.time.LocalDate navDate);
}
