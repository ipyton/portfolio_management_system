package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.entity.AssetPriceDailyEntity;
import com.noah.portfolio.asset.model.AssetPriceHistoryPoint;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetPriceDailyRepository extends JpaRepository<AssetPriceDailyEntity, Long> {

    @Query("""
            select new com.noah.portfolio.asset.model.AssetPriceHistoryPoint(
                p.asset.id,
                p.close,
                p.tradeDate
            )
            from AssetPriceDailyEntity p
            where p.asset.id = :assetId
                and p.tradeDate between :startDate and :endDate
            order by p.tradeDate asc
            """)
    List<AssetPriceHistoryPoint> findPriceHistory(
            @Param("assetId") Long assetId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("""
            select p.tradeDate
            from AssetPriceDailyEntity p
            where p.asset.id = :assetId
                and p.tradeDate between :startDate and :endDate
            """)
    List<LocalDate> findTradeDates(
            @Param("assetId") Long assetId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query(value = """
            select count(*)
            from information_schema.columns
            where table_schema = database()
                and table_name = 'asset_price_daily'
                and column_name in ('open', 'high', 'low')
            """, nativeQuery = true)
    long countOhlcColumns();

    @Modifying
    @Query(value = """
            insert into asset_price_daily (asset_id, trade_date, `open`, high, low, close, volume)
            values (:assetId, :tradeDate, :open, :high, :low, :close, :volume)
            """, nativeQuery = true)
    int insertPriceWithOhlc(
            @Param("assetId") Long assetId,
            @Param("tradeDate") LocalDate tradeDate,
            @Param("open") BigDecimal open,
            @Param("high") BigDecimal high,
            @Param("low") BigDecimal low,
            @Param("close") BigDecimal close,
            @Param("volume") Long volume
    );

    @Modifying
    @Query(value = """
            insert into asset_price_daily (asset_id, trade_date, close)
            values (:assetId, :tradeDate, :close)
            """, nativeQuery = true)
    int insertPriceCloseOnly(
            @Param("assetId") Long assetId,
            @Param("tradeDate") LocalDate tradeDate,
            @Param("close") BigDecimal close
    );

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
