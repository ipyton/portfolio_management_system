package com.noah.portfolio.asset.dto;

import java.util.List;

public record AssetRecommendationResponse(
        String profile,
        int count,
        List<AssetRecommendationItem> items,
        List<String> warnings
) {
}
