package com.noah.portfolio.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface AssetSearchDataRepository {

    List<AssetEntity> searchAssets(String query, int limit);

    Map<Long, AssetLatestPriceSnapshot> findLatestPriceSnapshots(List<Long> assetIds);
}

record AssetLatestPriceSnapshot(
        Long assetId,
        BigDecimal close,
        LocalDate tradeDate
) {
}
