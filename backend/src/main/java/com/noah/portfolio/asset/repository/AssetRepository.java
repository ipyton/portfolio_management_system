package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.service.*;

import java.util.List;
import java.util.Optional;
import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetRepository extends JpaRepository<AssetEntity, Long> {

    Optional<AssetEntity> findFirstBySymbolIgnoreCaseOrderByIdAsc(String symbol);

    Optional<AssetEntity> findFirstBySymbolIgnoreCaseAndAssetTypeOrderByIdAsc(String symbol, AssetType assetType);

    @Query("select coalesce(max(a.id), 0) from AssetEntity a")
    Long findMaxId();

    @Modifying
    @Query("""
            update AssetEntity a
            set a.lastPriceRefreshedAt = :refreshedAt
            where a.id = :assetId
            """)
    int touchLastPriceRefreshedAt(
            @Param("assetId") Long assetId,
            @Param("refreshedAt") Instant refreshedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update AssetEntity a
            set a.exchange = :exchange,
                a.region = :region
            where a.id = :assetId
            """)
    int updateVenueMetadata(
            @Param("assetId") Long assetId,
            @Param("exchange") String exchange,
            @Param("region") String region
    );

    @Query("""
            select distinct a
            from AssetEntity a
            left join fetch a.stockDetail
            where a.assetType = com.noah.portfolio.asset.model.AssetType.STOCK
                and (
                    lower(a.symbol) like concat('%', lower(:keyword), '%')
                    or lower(a.name) like concat('%', lower(:keyword), '%')
                )
            order by case
                when lower(a.symbol) = lower(:keyword) then 0
                when lower(a.symbol) like concat(lower(:keyword), '%') then 1
                when lower(a.name) like concat(lower(:keyword), '%') then 2
                else 3
            end,
            a.symbol asc
            """)
    List<AssetEntity> searchStocks(@Param("keyword") String keyword);

    @Query("""
            select a
            from AssetEntity a
            where a.assetType = com.noah.portfolio.asset.model.AssetType.INDEX
                and a.benchmark = true
            order by
                case when a.region is null then 1 else 0 end,
                a.region asc,
                a.symbol asc
            """)
    List<AssetEntity> findBenchmarkIndices();

    List<AssetEntity> findAllByAssetTypeOrderBySymbolAsc(AssetType assetType);
}
