package com.noah.portfolio.asset.dto;

public record AssetCandidate(
        Long assetId,
        String symbol,
        String name,
        String assetType,
        String exchange,
        String region
) {
}
