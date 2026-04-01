package com.noah.portfolio.asset.dto;

public record AssetWorldIndexItem(
        String symbol,
        String name,
        String region,
        String exchange,
        String currency
) {
}
