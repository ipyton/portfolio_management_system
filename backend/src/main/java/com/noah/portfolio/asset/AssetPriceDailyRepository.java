package com.noah.portfolio.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetPriceDailyRepository extends JpaRepository<AssetPriceDailyEntity, Long> {

    @Query("""
            select p.asset.id as assetId, p.close as close, p.tradeDate as tradeDate
            from AssetPriceDailyEntity p
            where p.asset.id in :assetIds
                and p.tradeDate = (
                    select max(p2.tradeDate)
                    from AssetPriceDailyEntity p2
                    where p2.asset.id = p.asset.id
                )
            """)
    List<AssetLatestPriceView> findLatestPriceViewsByAssetIdIn(@Param("assetIds") Collection<Long> assetIds);

    @Query("""
            select a.symbol as symbol,
                a.name as name,
                coalesce(a.region, 'UNKNOWN') as region,
                p.tradeDate as tradeDate,
                p.close as close
            from AssetPriceDailyEntity p
            join p.asset a
            where a.benchmark = true
                and p.tradeDate between :startDate and :endDate
            order by a.symbol, p.tradeDate
            """)
    List<BenchmarkPriceView> findBenchmarkPriceSeries(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    interface AssetLatestPriceView {
        Long getAssetId();

        BigDecimal getClose();

        LocalDate getTradeDate();
    }

    interface BenchmarkPriceView {
        String getSymbol();

        String getName();

        String getRegion();

        LocalDate getTradeDate();

        BigDecimal getClose();
    }
}
