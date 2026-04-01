package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.service.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface AssetSearchDataRepository {

    List<AssetEntity> searchAssets(String query, int limit);

    Map<Long, AssetLatestPriceSnapshot> findLatestPriceSnapshots(List<Long> assetIds);

    default Map<Long, AssetPriceWindowSnapshot> findLatestPriceWindows(List<Long> assetIds) {
        return Map.of();
    }

    default List<AssetEntity> listRecommendationCandidates(int limit) {
        return List.of();
    }

    default Map<Long, List<AssetPriceHistoryPoint>> findRecentPriceHistory(List<Long> assetIds, LocalDate startDate) {
        return Map.of();
    }
}
