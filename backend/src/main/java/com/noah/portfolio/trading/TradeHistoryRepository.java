package com.noah.portfolio.trading;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TradeHistoryRepository extends JpaRepository<TradeHistoryEntity, Long> {

    List<TradeHistoryEntity> findByHoldingUserIdOrderByIdDesc(Long userId);
}
