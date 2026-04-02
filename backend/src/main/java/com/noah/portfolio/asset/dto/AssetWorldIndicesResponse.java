package com.noah.portfolio.asset.dto;

import java.util.List;

public record AssetWorldIndicesResponse(
        int count,
        List<AssetWorldIndexItem> items
) {
}
