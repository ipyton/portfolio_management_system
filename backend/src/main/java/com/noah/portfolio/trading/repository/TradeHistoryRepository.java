package com.noah.portfolio.trading.repository;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.service.*;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeHistoryRepository extends JpaRepository<TradeHistoryEntity, Long> {

    Optional<TradeHistoryEntity> findByBizId(String bizId);

    List<TradeHistoryEntity> findByHoldingUserIdOrderByIdDesc(Long userId);

    @Query("""
            select th
            from TradeHistoryEntity th
            join fetch th.holding h
            join fetch h.asset a
            where h.user.id = :userId
            order by th.tradedAt desc, th.id desc
            """)
    List<TradeHistoryEntity> findDetailedTradeHistoryByUserId(@Param("userId") Long userId);
}
