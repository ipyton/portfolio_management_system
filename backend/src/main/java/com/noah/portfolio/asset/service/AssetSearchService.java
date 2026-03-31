package com.noah.portfolio.asset.service;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class AssetSearchService {

    private static final int SEARCH_LIMIT = 5;

    private final AssetSearchDataRepository assetSearchDataRepository;
    private final YahooFinanceClient yahooFinanceClient;

    public AssetSearchService(
            AssetSearchDataRepository assetSearchDataRepository,
            YahooFinanceClient yahooFinanceClient
    ) {
        this.assetSearchDataRepository = assetSearchDataRepository;
        this.yahooFinanceClient = yahooFinanceClient;
    }

    public AssetSearchResponse search(String query) {
        String normalizedQuery = normalizeQuery(query);
        List<AssetEntity> matchedAssets = assetSearchDataRepository.searchAssets(normalizedQuery, SEARCH_LIMIT);
        Map<Long, AssetLatestPriceSnapshot> latestPrices = assetSearchDataRepository.findLatestPriceSnapshots(
                matchedAssets.stream().map(AssetEntity::getId).toList()
        );

        List<DatabaseAssetDetail> databaseMatches = matchedAssets.stream()
                .map(asset -> toDatabaseAssetDetail(asset, latestPrices.get(asset.getId())))
                .toList();
        DatabaseAssetDetail primaryDatabaseMatch = databaseMatches.isEmpty() ? null : databaseMatches.get(0);
        List<String> warnings = new ArrayList<>();

        String matchedSource;
        String resolvedSymbol;
        if (primaryDatabaseMatch != null) {
            matchedSource = "DATABASE";
            resolvedSymbol = primaryDatabaseMatch.symbol();
        } else {
            YahooFinanceSearchResult yahooSearchResult;
            try {
                yahooSearchResult = yahooFinanceClient.searchBestMatch(normalizedQuery)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "No asset matched the query in the database or Yahoo Finance."
                        ));
            } catch (YahooFinanceClient.YahooFinanceLookupException ex) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Database returned no asset, and Yahoo Finance search failed.",
                        ex
                );
            }

            matchedSource = "YAHOO_FINANCE";
            resolvedSymbol = yahooSearchResult.symbol();
            warnings.add("No local asset matched the query. The symbol was resolved through Yahoo Finance search.");
        }

        YahooFinanceDetail yahooFinanceDetail = null;
        try {
            yahooFinanceDetail = yahooFinanceClient.fetchDetail(resolvedSymbol).orElse(null);
            if (yahooFinanceDetail == null) {
                warnings.add("Yahoo Finance did not return quote detail for symbol " + resolvedSymbol + ".");
            }
        } catch (YahooFinanceClient.YahooFinanceLookupException ex) {
            if (primaryDatabaseMatch == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Failed to load asset detail from Yahoo Finance.",
                        ex
                );
            }
            warnings.add("Yahoo Finance detail lookup failed. Returning database detail only.");
        }

        return new AssetSearchResponse(
                normalizedQuery,
                matchedSource,
                resolvedSymbol,
                primaryDatabaseMatch,
                yahooFinanceDetail,
                databaseMatches.stream().map(this::toCandidate).toList(),
                warnings
        );
    }

    private DatabaseAssetDetail toDatabaseAssetDetail(AssetEntity asset, AssetLatestPriceSnapshot latestPrice) {
        AssetStockDetailEntity stockDetail = asset.getStockDetail();
        AssetEtfDetailEntity etfDetail = asset.getEtfDetail();
        AssetFundDetailEntity fundDetail = asset.getFundDetail();
        AssetFuturesDetailEntity futuresDetail = asset.getFuturesDetail();
        AssetCryptoDetailEntity cryptoDetail = asset.getCryptoDetail();
        AssetBondDetailEntity bondDetail = asset.getBondDetail();

        return new DatabaseAssetDetail(
                asset.getId(),
                asset.getSymbol(),
                asset.getName(),
                asset.getAssetType().name(),
                asset.getCurrency(),
                asset.getExchange(),
                asset.getRegion(),
                asset.isBenchmark(),
                stockDetail == null ? null : stockDetail.getSector(),
                stockDetail == null ? null : stockDetail.getIndustry(),
                stockDetail == null ? null : stockDetail.getMarketCap(),
                stockDetail == null ? null : stockDetail.getPeRatio(),
                firstNonBlank(
                        etfDetail == null ? null : etfDetail.getFundFamily(),
                        fundDetail == null ? null : fundDetail.getFundFamily()
                ),
                firstNonNull(
                        etfDetail == null ? null : etfDetail.getExpenseRatio(),
                        fundDetail == null ? null : fundDetail.getExpenseRatio()
                ),
                etfDetail == null ? null : etfDetail.getBenchmark(),
                fundDetail == null || fundDetail.getFundType() == null ? null : fundDetail.getFundType().name(),
                fundDetail == null ? null : fundDetail.getNav(),
                futuresDetail == null ? null : futuresDetail.getUnderlying(),
                futuresDetail == null ? null : futuresDetail.getExpiryDate(),
                futuresDetail == null ? null : futuresDetail.getContractSize(),
                futuresDetail == null ? null : futuresDetail.getMarginRate(),
                cryptoDetail == null ? null : cryptoDetail.getChain(),
                cryptoDetail == null ? null : cryptoDetail.getContractAddress(),
                cryptoDetail == null ? null : cryptoDetail.getCoingeckoId(),
                bondDetail == null ? null : bondDetail.getIssuer(),
                bondDetail == null || bondDetail.getBondType() == null ? null : bondDetail.getBondType().name(),
                bondDetail == null ? null : bondDetail.getFaceValue(),
                bondDetail == null ? null : bondDetail.getCouponRate(),
                bondDetail == null ? null : bondDetail.getMaturityDate(),
                latestPrice == null ? null : latestPrice.close(),
                latestPrice == null ? null : latestPrice.tradeDate()
        );
    }

    private AssetCandidate toCandidate(DatabaseAssetDetail detail) {
        return new AssetCandidate(
                detail.assetId(),
                detail.symbol(),
                detail.name(),
                detail.assetType(),
                detail.exchange(),
                detail.region()
        );
    }

    private String normalizeQuery(String query) {
        if (!StringUtils.hasText(query)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query must not be blank.");
        }
        return query.trim();
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }
}
