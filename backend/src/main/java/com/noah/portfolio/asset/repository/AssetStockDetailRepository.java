package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.entity.AssetStockDetailEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetStockDetailRepository extends JpaRepository<AssetStockDetailEntity, Long> {

    @Modifying
    @Query(
            value = """
                    INSERT INTO asset_stock_detail (asset_id, sector, industry, market_cap, pe_ratio)
                    VALUES (:assetId, :sector, :industry, :marketCap, :peRatio)
                    ON DUPLICATE KEY UPDATE
                        sector = VALUES(sector),
                        industry = VALUES(industry),
                        market_cap = VALUES(market_cap),
                        pe_ratio = VALUES(pe_ratio)
                    """,
            nativeQuery = true
    )
    int upsertByAssetId(
            @Param("assetId") Long assetId,
            @Param("sector") String sector,
            @Param("industry") String industry,
            @Param("marketCap") Long marketCap,
            @Param("peRatio") java.math.BigDecimal peRatio
    );
}
