package com.noah.portfolio.asset.service;

import com.noah.portfolio.asset.client.FinnhubClient;
import com.noah.portfolio.asset.client.YahooFinanceClient;
import com.noah.portfolio.asset.dto.YahooFinanceDetail;
import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.entity.AssetStockDetailEntity;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.asset.repository.AssetRepository;
import com.noah.portfolio.asset.repository.AssetStockDetailRepository;
import com.noah.portfolio.trading.entity.HoldingEntity;
import com.noah.portfolio.trading.repository.HoldingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AssetMetadataEnrichmentService {

    private static final Logger log = LoggerFactory.getLogger(AssetMetadataEnrichmentService.class);
    private static final Duration ENRICH_RETRY_COOLDOWN = Duration.ofHours(6);
    private static final int CATEGORY_TEXT_MAX_LENGTH = 50;

    private final HoldingRepository holdingRepository;
    private final AssetRepository assetRepository;
    private final AssetStockDetailRepository assetStockDetailRepository;
    private final FinnhubClient finnhubClient;
    private final YahooFinanceClient yahooFinanceClient;
    private final Map<Long, Instant> lastAttemptAtByAssetId = new ConcurrentHashMap<>();

    public AssetMetadataEnrichmentService(
            HoldingRepository holdingRepository,
            AssetRepository assetRepository,
            AssetStockDetailRepository assetStockDetailRepository,
            FinnhubClient finnhubClient,
            YahooFinanceClient yahooFinanceClient
    ) {
        this.holdingRepository = holdingRepository;
        this.assetRepository = assetRepository;
        this.assetStockDetailRepository = assetStockDetailRepository;
        this.finnhubClient = finnhubClient;
        this.yahooFinanceClient = yahooFinanceClient;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int enrichMissingStockMetadataForUser(Long userId) {
        if (userId == null) {
            return 0;
        }
        LinkedHashSet<Long> stockAssetIds = holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(userId).stream()
                .map(HoldingEntity::getAsset)
                .filter(asset -> asset.getAssetType() == AssetType.STOCK)
                .map(AssetEntity::getId)
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll);

        int updated = 0;
        Instant now = Instant.now();
        for (Long assetId : stockAssetIds) {
            if (!shouldAttempt(assetId, now)) {
                continue;
            }
            if (enrichStockMetadataByAssetId(assetId, false)) {
                updated++;
            }
        }
        return updated;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean enrichStockMetadataBySymbol(String symbol) {
        if (!StringUtils.hasText(symbol)) {
            return false;
        }
        Optional<AssetEntity> assetOptional = assetRepository.findFirstBySymbolIgnoreCaseAndAssetTypeOrderByIdAsc(
                symbol.trim().toUpperCase(Locale.ROOT),
                AssetType.STOCK
        );
        if (assetOptional.isEmpty()) {
            return false;
        }
        return enrichStockMetadataByAssetId(assetOptional.get().getId(), true);
    }

    private boolean enrichStockMetadataByAssetId(Long assetId, boolean forceAttempt) {
        AssetEntity asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null || asset.getAssetType() != AssetType.STOCK) {
            return false;
        }

        AssetStockDetailEntity existing = assetStockDetailRepository.findById(assetId).orElse(null);
        if (!forceAttempt && !isCategoryMetadataMissing(existing)) {
            return false;
        }

        Instant now = Instant.now();
        if (!forceAttempt && !shouldAttempt(assetId, now)) {
            return false;
        }
        lastAttemptAtByAssetId.put(assetId, now);

        YahooFinanceDetail detail = fetchRemoteDetail(asset.getSymbol());
        if (detail == null) {
            return false;
        }

        String industry = normalizeCategoryText(firstNonBlank(detail.industry(), detail.sector()));
        String sector = normalizeCategoryText(firstNonBlank(detail.sector(), industry));
        Long marketCap = detail.marketCap() != null && detail.marketCap() > 0 ? detail.marketCap() : null;
        BigDecimal peRatio = normalizePeRatio(firstNonNull(detail.trailingPe(), detail.forwardPe()));

        if (!StringUtils.hasText(industry)
                && !StringUtils.hasText(sector)
                && marketCap == null
                && peRatio == null) {
            return false;
        }

        assetStockDetailRepository.upsertByAssetId(asset.getId(), sector, industry, marketCap, peRatio);
        lastAttemptAtByAssetId.remove(assetId);
        return true;
    }

    private YahooFinanceDetail fetchRemoteDetail(String symbol) {
        try {
            YahooFinanceDetail detail = finnhubClient.fetchDetail(symbol).orElse(null);
            if (detail != null) {
                return detail;
            }
        } catch (RuntimeException ex) {
            log.debug("Finnhub metadata lookup failed for symbol {}: {}", symbol, ex.getMessage());
        }

        try {
            return yahooFinanceClient.fetchDetail(symbol).orElse(null);
        } catch (RuntimeException ex) {
            log.debug("Yahoo metadata lookup failed for symbol {}: {}", symbol, ex.getMessage());
            return null;
        }
    }

    private boolean isCategoryMetadataMissing(AssetStockDetailEntity detail) {
        return detail == null
                || (!StringUtils.hasText(detail.getSector()) && !StringUtils.hasText(detail.getIndustry()));
    }

    private boolean shouldAttempt(Long assetId, Instant now) {
        Instant lastAttempt = lastAttemptAtByAssetId.get(assetId);
        return lastAttempt == null || Duration.between(lastAttempt, now).compareTo(ENRICH_RETRY_COOLDOWN) >= 0;
    }

    private String normalizeCategoryText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= CATEGORY_TEXT_MAX_LENGTH
                ? trimmed
                : trimmed.substring(0, CATEGORY_TEXT_MAX_LENGTH);
    }

    private BigDecimal normalizePeRatio(BigDecimal peRatio) {
        return peRatio == null ? null : peRatio.setScale(2, RoundingMode.HALF_UP);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private <T> T firstNonNull(T left, T right) {
        return left != null ? left : right;
    }
}
