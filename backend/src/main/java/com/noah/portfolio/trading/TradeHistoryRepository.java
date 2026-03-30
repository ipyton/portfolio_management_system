package com.noah.portfolio.trading;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TradeHistoryRepository extends JpaRepository<TradeHistoryEntity, Long> {

    Optional<TradeHistoryEntity> findByBizId(String bizId);

    List<TradeHistoryEntity> findByHoldingUserIdOrderByIdDesc(Long userId);
}
