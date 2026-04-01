package com.noah.portfolio.asset.dto;

import java.util.List;

public record AssetRecommendationItem(
        Long assetId,
        String symbol,
        String name,
        String assetType,
        String exchange,
        String region,
        double score,
        double targetWeight,
        List<String> reasons
) {
}
