package com.noah.portfolio.asset.dto;

import java.util.List;

public record AssetCandleHistoryResponse(
        String query,
        String resolvedSymbol,
        String source,
        int count,
        List<AssetCandleHistoryItem> items,
        List<String> warnings
) {
}
