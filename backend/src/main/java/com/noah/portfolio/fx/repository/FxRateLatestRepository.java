package com.noah.portfolio.fx.repository;

import com.noah.portfolio.fx.config.*;
import com.noah.portfolio.fx.controller.*;
import com.noah.portfolio.fx.entity.*;
import com.noah.portfolio.fx.service.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FxRateLatestRepository extends JpaRepository<FxRateLatestEntity, Long> {

    Optional<FxRateLatestEntity> findByBaseCurrencyAndQuoteCurrency(String baseCurrency, String quoteCurrency);

    List<FxRateLatestEntity> findByQuoteCurrencyOrderByBaseCurrencyAsc(String quoteCurrency);

    @Query("select max(f.asOf) from FxRateLatestEntity f")
    Instant findMaxAsOf();
}
