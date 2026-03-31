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

public interface HoldingRepository extends JpaRepository<HoldingEntity, Long> {

    Optional<HoldingEntity> findByUserIdAndAssetId(Long userId, Long assetId);

    List<HoldingEntity> findByUserIdOrderByIdDesc(Long userId);

    @Query("""
            select distinct h
            from HoldingEntity h
            join fetch h.asset a
            left join fetch a.stockDetail
            where h.user.id = :userId
                and h.quantity <> 0
            order by a.symbol
            """)
    List<HoldingEntity> findActiveHoldingsWithAssetDetailsByUserId(@Param("userId") Long userId);
}
