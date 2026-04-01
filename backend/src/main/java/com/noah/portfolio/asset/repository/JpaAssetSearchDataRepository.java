package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.service.*;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Repository
public class JpaAssetSearchDataRepository implements AssetSearchDataRepository {

    private static final String SEARCH_ASSETS_JPQL = """
            select distinct a
            from AssetEntity a
            left join fetch a.stockDetail
            left join fetch a.etfDetail
            left join fetch a.fundDetail
            left join fetch a.futuresDetail
            left join fetch a.cryptoDetail
            left join fetch a.bondDetail
            where lower(a.symbol) = lower(:query)
                or lower(a.name) = lower(:query)
                or lower(a.symbol) like concat(lower(:query), '%')
                or lower(a.name) like concat(lower(:query), '%')
                or lower(a.symbol) like concat(concat('%', lower(:query)), '%')
                or lower(a.name) like concat(concat('%', lower(:query)), '%')
            order by case
                when lower(a.symbol) = lower(:query) then 0
                when lower(a.name) = lower(:query) then 1
                when lower(a.symbol) like concat(lower(:query), '%') then 2
                when lower(a.name) like concat(lower(:query), '%') then 3
                else 4
            end,
            a.symbol asc
            """;

    private static final String LATEST_PRICE_JPQL = """
            select new com.noah.portfolio.asset.model.AssetLatestPriceSnapshot(
                p.asset.id,
                p.close,
                p.tradeDate
            )
            from AssetPriceDailyEntity p
            where p.asset.id in :assetIds
                and p.tradeDate = (
                    select max(p2.tradeDate)
                    from AssetPriceDailyEntity p2
                    where p2.asset.id = p.asset.id
                )
            """;

    private static final String PRICE_HISTORY_JPQL = """
            select new com.noah.portfolio.asset.model.AssetPriceHistoryPoint(
                p.asset.id,
                p.close,
                p.tradeDate
            )
            from AssetPriceDailyEntity p
            where p.asset.id in :assetIds
            order by p.asset.id asc, p.tradeDate desc
            """;

    private static final String RECOMMENDATION_CANDIDATES_JPQL = """
            select distinct a
            from AssetEntity a
            left join fetch a.stockDetail sd
            left join fetch a.etfDetail
            left join fetch a.fundDetail
            where a.assetType in :assetTypes
            order by case when a.benchmark = true then 0 else 1 end,
                case
                    when a.assetType = com.noah.portfolio.asset.model.AssetType.INDEX then 0
                    when a.assetType = com.noah.portfolio.asset.model.AssetType.ETF then 1
                    when a.assetType = com.noah.portfolio.asset.model.AssetType.STOCK then 2
                    else 3
                end,
                coalesce(sd.marketCap, 0) desc,
                a.symbol asc
            """;

    private static final String RECENT_PRICE_HISTORY_JPQL = """
            select new com.noah.portfolio.asset.model.AssetPriceHistoryPoint(
                p.asset.id,
                p.close,
                p.tradeDate
            )
            from AssetPriceDailyEntity p
            where p.asset.id in :assetIds
                and p.tradeDate >= :startDate
            order by p.asset.id asc, p.tradeDate asc
            """;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<AssetEntity> searchAssets(String query, int limit) {
        return entityManager.createQuery(SEARCH_ASSETS_JPQL, AssetEntity.class)
                .setParameter("query", query)
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public Map<Long, AssetLatestPriceSnapshot> findLatestPriceSnapshots(List<Long> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return Collections.emptyMap();
        }

        List<AssetLatestPriceSnapshot> snapshots = entityManager.createQuery(
                        LATEST_PRICE_JPQL,
                        AssetLatestPriceSnapshot.class
                )
                .setParameter("assetIds", assetIds)
                .getResultList();

        Map<Long, AssetLatestPriceSnapshot> byAssetId = new LinkedHashMap<>();
        for (AssetLatestPriceSnapshot snapshot : snapshots) {
            byAssetId.put(snapshot.assetId(), snapshot);
        }
        return byAssetId;
    }

    @Override
    public Map<Long, AssetPriceWindowSnapshot> findLatestPriceWindows(List<Long> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return Collections.emptyMap();
        }

        List<AssetPriceHistoryPoint> points = entityManager.createQuery(
                        PRICE_HISTORY_JPQL,
                        AssetPriceHistoryPoint.class
                )
                .setParameter("assetIds", assetIds)
                .getResultList();

        Map<Long, AssetPriceWindowSnapshot> windows = new LinkedHashMap<>();
        for (AssetPriceHistoryPoint point : points) {
            AssetPriceWindowSnapshot existing = windows.get(point.assetId());
            if (existing == null) {
                windows.put(point.assetId(), new AssetPriceWindowSnapshot(
                        point.assetId(),
                        point.close(),
                        point.tradeDate(),
                        null,
                        null
                ));
                continue;
            }

            if (existing.previousClose() == null) {
                windows.put(point.assetId(), new AssetPriceWindowSnapshot(
                        existing.assetId(),
                        existing.latestClose(),
                        existing.latestTradeDate(),
                        point.close(),
                        point.tradeDate()
                ));
            }
        }
        return windows;
    }

    @Override
    public List<AssetEntity> listRecommendationCandidates(int limit) {
        if (limit < 1) {
            return List.of();
        }
        return entityManager.createQuery(RECOMMENDATION_CANDIDATES_JPQL, AssetEntity.class)
                .setParameter(
                        "assetTypes",
                        List.of(AssetType.STOCK, AssetType.ETF, AssetType.FUND, AssetType.INDEX)
                )
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public Map<Long, List<AssetPriceHistoryPoint>> findRecentPriceHistory(List<Long> assetIds, LocalDate startDate) {
        if (assetIds == null || assetIds.isEmpty()) {
            return Map.of();
        }

        List<AssetPriceHistoryPoint> points = entityManager.createQuery(
                        RECENT_PRICE_HISTORY_JPQL,
                        AssetPriceHistoryPoint.class
                )
                .setParameter("assetIds", assetIds)
                .setParameter("startDate", startDate)
                .getResultList();

        Map<Long, List<AssetPriceHistoryPoint>> byAssetId = new LinkedHashMap<>();
        for (AssetPriceHistoryPoint point : points) {
            byAssetId.computeIfAbsent(point.assetId(), ignored -> new java.util.ArrayList<>()).add(point);
        }
        return byAssetId;
    }
}
