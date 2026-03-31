package com.noah.portfolio.analytics;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PortfolioNavDailyRepository extends JpaRepository<PortfolioNavDailyEntity, Long> {

    List<PortfolioNavDailyEntity> findByUser_IdOrderByNavDateAsc(Long userId);
}
