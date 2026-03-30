package com.noah.portfolio.asset;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class StockSearchService {

    private final AssetRepository assetRepository;
    private final AssetSearchDataRepository assetSearchDataRepository;

    public StockSearchService(
            AssetRepository assetRepository,
            AssetSearchDataRepository assetSearchDataRepository
    ) {
        this.assetRepository = assetRepository;
        this.assetSearchDataRepository = assetSearchDataRepository;
    }

    public StockSearchResponse search(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keyword must not be blank.");
        }

        String normalizedKeyword = keyword.trim();
        List<AssetEntity> assets = assetRepository.searchStocks(normalizedKeyword);
        Map<Long, AssetLatestPriceSnapshot> latestPrices = assetSearchDataRepository.findLatestPriceSnapshots(
                assets.stream().map(AssetEntity::getId).toList()
        );

        List<StockSearchItem> items = assets.stream()
                .map(asset -> toItem(asset, latestPrices.get(asset.getId())))
                .toList();
        return new StockSearchResponse(normalizedKeyword, items.size(), items);
    }

    private StockSearchItem toItem(AssetEntity asset, AssetLatestPriceSnapshot latestPrice) {
        AssetStockDetailEntity stockDetail = asset.getStockDetail();
        return new StockSearchItem(
                asset.getId(),
                asset.getSymbol(),
                asset.getName(),
                asset.getCurrency(),
                asset.getExchange(),
                asset.getRegion(),
                stockDetail == null ? null : stockDetail.getSector(),
                stockDetail == null ? null : stockDetail.getIndustry(),
                stockDetail == null ? null : stockDetail.getMarketCap(),
                stockDetail == null ? null : stockDetail.getPeRatio(),
                latestPrice == null ? null : latestPrice.close(),
                latestPrice == null ? null : latestPrice.tradeDate()
        );
    }
}
