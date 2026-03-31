package com.noah.portfolio.asset.dto;

import java.util.List;

public record AssetSuggestionResponse(
        String query,
        int count,
        List<AssetCandidate> items
) {
}
