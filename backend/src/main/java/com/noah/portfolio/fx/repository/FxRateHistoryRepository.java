package com.noah.portfolio.fx.repository;

import com.noah.portfolio.fx.config.*;
import com.noah.portfolio.fx.controller.*;
import com.noah.portfolio.fx.entity.*;
import com.noah.portfolio.fx.service.*;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FxRateHistoryRepository extends JpaRepository<FxRateHistoryEntity, Long> {
}
