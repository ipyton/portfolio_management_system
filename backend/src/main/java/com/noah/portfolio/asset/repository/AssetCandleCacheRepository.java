package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.entity.AssetCandleCacheEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetCandleCacheRepository extends JpaRepository<AssetCandleCacheEntity, Long> {

    List<AssetCandleCacheEntity> findBySymbolIgnoreCaseAndCandleIntervalAndTradeDateBetweenOrderByTradeDateAsc(
            String symbol,
            String candleInterval,
            LocalDate startDate,
            LocalDate endDate
    );

    Optional<AssetCandleCacheEntity> findFirstBySymbolIgnoreCaseAndCandleIntervalAndTradeDateOrderByIdAsc(
            String symbol,
            String candleInterval,
            LocalDate tradeDate
    );

    Optional<AssetCandleCacheEntity> findFirstBySymbolIgnoreCaseAndCandleIntervalOrderByTradeDateDesc(
            String symbol,
            String candleInterval
    );
}
