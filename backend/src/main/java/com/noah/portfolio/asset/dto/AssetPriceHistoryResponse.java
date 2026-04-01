package com.noah.portfolio.asset.dto;

import java.util.List;

public record AssetPriceHistoryResponse(
        String query,
        String resolvedSymbol,
        String source,
        int count,
        List<AssetPriceHistoryItem> items,
        List<String> warnings
) {
}
