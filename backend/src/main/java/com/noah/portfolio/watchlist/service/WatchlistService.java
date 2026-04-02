package com.noah.portfolio.watchlist.service;

import com.noah.portfolio.watchlist.controller.*;
import com.noah.portfolio.watchlist.dto.*;
import com.noah.portfolio.watchlist.entity.*;
import com.noah.portfolio.watchlist.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.noah.portfolio.asset.client.EastmoneyClient;
import com.noah.portfolio.asset.client.FinnhubClient;
import com.noah.portfolio.asset.client.TwelveDataClient;
import com.noah.portfolio.asset.client.YahooFinanceClient;
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;
import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.entity.AssetStockDetailEntity;
import com.noah.portfolio.asset.model.AssetPriceWindowSnapshot;
import com.noah.portfolio.asset.repository.AssetRepository;
import com.noah.portfolio.asset.repository.AssetSearchDataRepository;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

@Service
@Transactional
public class WatchlistService {

    private static final Logger log = LoggerFactory.getLogger(WatchlistService.class);
    private static final int REMOTE_LOOKBACK_DAYS = 10;
    private static final int STALE_TOLERANCE_DAYS = 3;
    private static final int MAX_ASSET_CREATE_RETRIES = 8;

    private final WatchlistRepository watchlistRepository;
    private final UserRepository userRepository;
    private final AssetRepository assetRepository;
    private final AssetSearchDataRepository assetSearchDataRepository;
    private final EastmoneyClient eastmoneyClient;
    private final TwelveDataClient twelveDataClient;
    private final FinnhubClient finnhubClient;
    private final YahooFinanceClient yahooFinanceClient;
    @PersistenceContext
    private EntityManager entityManager;

    public WatchlistService(
            WatchlistRepository watchlistRepository,
            UserRepository userRepository,
            AssetRepository assetRepository,
            AssetSearchDataRepository assetSearchDataRepository,
            EastmoneyClient eastmoneyClient,
            TwelveDataClient twelveDataClient,
            FinnhubClient finnhubClient,
            YahooFinanceClient yahooFinanceClient
    ) {
        this.watchlistRepository = watchlistRepository;
        this.userRepository = userRepository;
        this.assetRepository = assetRepository;
        this.assetSearchDataRepository = assetSearchDataRepository;
        this.eastmoneyClient = eastmoneyClient;
        this.twelveDataClient = twelveDataClient;
        this.finnhubClient = finnhubClient;
        this.yahooFinanceClient = yahooFinanceClient;
    }

    @Transactional(readOnly = true)
    public WatchlistResponse getWatchlist(Long userId) {
        ensureUserExists(userId);
        List<WatchlistEntity> watchlists = watchlistRepository.findByUserIdOrderByAddedAtDesc(userId);
        Map<Long, AssetPriceWindowSnapshot> priceWindows = assetSearchDataRepository.findLatestPriceWindows(
                watchlists.stream().map(item -> item.getAsset().getId()).toList()
        );
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(REMOTE_LOOKBACK_DAYS - 1L);
        List<WatchlistItem> items = watchlists.stream()
                .map(watchlist -> {
                    AssetEntity asset = watchlist.getAsset();
                    AssetPriceWindowSnapshot localWindow = priceWindows.get(asset.getId());
                    AssetPriceWindowSnapshot resolvedWindow = resolvePriceWindow(asset, localWindow, startDate, endDate);
                    return toItem(watchlist, resolvedWindow);
                })
                .toList();
        return new WatchlistResponse(userId, items.size(), items);
    }

    public WatchlistItem addToWatchlist(WatchlistRequest request) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = resolveStockAsset(request);

        watchlistRepository.findByUserIdAndAssetId(request.userId(), asset.getId())
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "The stock is already in the watchlist.");
                });

        WatchlistEntity saved = watchlistRepository.save(new WatchlistEntity(user, asset, request.note()));
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(REMOTE_LOOKBACK_DAYS - 1L);
        AssetPriceWindowSnapshot localWindow = assetSearchDataRepository.findLatestPriceWindows(List.of(asset.getId())).get(asset.getId());
        AssetPriceWindowSnapshot resolvedWindow = resolvePriceWindow(asset, localWindow, startDate, endDate);
        return toItem(saved, resolvedWindow);
    }

    public void removeFromWatchlist(Long userId, Long assetId) {
        ensureUserExists(userId);
        WatchlistEntity watchlist = watchlistRepository.findByUserIdAndAssetId(userId, assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "The stock is not in the watchlist."));
        watchlistRepository.delete(watchlist);
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
    }

    private UserEntity requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private AssetEntity resolveStockAsset(WatchlistRequest request) {
        if (request.assetId() != null) {
            return requireStockAsset(request.assetId());
        }

        if (!StringUtils.hasText(request.symbol())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assetId or symbol must be provided.");
        }

        String symbol = request.symbol().trim().toUpperCase(Locale.ROOT);
        AssetEntity existing = assetRepository
                .findFirstBySymbolIgnoreCaseAndAssetTypeOrderByIdAsc(symbol, AssetType.STOCK)
                .orElse(null);
        if (existing != null) {
            return existing;
        }

        String name = limitLength(StringUtils.hasText(request.name()) ? request.name().trim() : symbol, 100);
        String currency = limitLength(
                StringUtils.hasText(request.currency()) ? request.currency().trim().toUpperCase(Locale.ROOT) : "USD",
                10
        );
        String exchange = limitLength(StringUtils.hasText(request.exchange()) ? request.exchange().trim() : "UNKNOWN", 20);
        String region = limitLength(StringUtils.hasText(request.region()) ? request.region().trim() : "UNKNOWN", 50);

        for (int attempt = 1; attempt <= MAX_ASSET_CREATE_RETRIES; attempt += 1) {
            Long maxId = assetRepository.findMaxId();
            Long nextId = (maxId == null ? 0L : maxId) + 1L;
            try {
                return assetRepository.saveAndFlush(new AssetEntity(
                        nextId,
                        symbol,
                        AssetType.STOCK,
                        name,
                        currency,
                        exchange,
                        region,
                        false
                ));
            } catch (DataIntegrityViolationException ex) {
                entityManager.clear();
                AssetEntity existingAsset = assetRepository
                        .findFirstBySymbolIgnoreCaseAndAssetTypeOrderByIdAsc(symbol, AssetType.STOCK)
                        .orElse(null);
                if (existingAsset != null) {
                    return existingAsset;
                }
                if (attempt == MAX_ASSET_CREATE_RETRIES) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Failed to create stock asset.", ex);
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Failed to create stock asset.");
    }

    private AssetEntity requireStockAsset(Long assetId) {
        AssetEntity asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found."));
        if (asset.getAssetType() != AssetType.STOCK) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only stocks can be added to the watchlist.");
        }
        return asset;
    }

    private String limitLength(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private AssetPriceWindowSnapshot resolvePriceWindow(
            AssetEntity asset,
            AssetPriceWindowSnapshot localWindow,
            LocalDate startDate,
            LocalDate endDate
    ) {
        if (!needsRemoteRefresh(localWindow, endDate)) {
            return localWindow;
        }

        List<AssetPriceHistoryItem> remoteHistory = fetchRemoteHistoryWithFallback(asset.getSymbol(), startDate, endDate);
        AssetPriceWindowSnapshot remoteWindow = toPriceWindow(asset.getId(), remoteHistory);
        return remoteWindow != null ? remoteWindow : localWindow;
    }

    private boolean needsRemoteRefresh(AssetPriceWindowSnapshot localWindow, LocalDate endDate) {
        if (localWindow == null || localWindow.latestClose() == null || localWindow.latestTradeDate() == null) {
            return true;
        }
        LocalDate staleThreshold = endDate.minusDays(STALE_TOLERANCE_DAYS);
        return localWindow.latestTradeDate().isBefore(staleThreshold);
    }

    private List<AssetPriceHistoryItem> fetchRemoteHistoryWithFallback(
            String symbol,
            LocalDate startDate,
            LocalDate endDate
    ) {
        for (RemoteHistoryProvider provider : buildRemoteHistoryProviders(symbol, startDate, endDate)) {
            try {
                List<AssetPriceHistoryItem> items = provider.fetcher().get();
                if (items != null && !items.isEmpty()) {
                    return items;
                }
            } catch (RuntimeException ex) {
                log.debug(
                        "Watchlist quote fallback from {} for symbol {}: {}",
                        provider.displayName(),
                        symbol,
                        ex.getMessage()
                );
            }
        }
        return List.of();
    }

    private List<RemoteHistoryProvider> buildRemoteHistoryProviders(
            String symbol,
            LocalDate startDate,
            LocalDate endDate
    ) {
        List<RemoteHistoryProvider> providers = new ArrayList<>(3);
        if (eastmoneyClient.supportsSymbol(symbol)) {
            providers.add(new RemoteHistoryProvider(
                    "Eastmoney",
                    () -> eastmoneyClient.fetchDailyHistory(symbol, startDate, endDate)
            ));
        } else {
            providers.add(new RemoteHistoryProvider(
                    "Twelve Data",
                    () -> twelveDataClient.fetchDailyHistory(symbol, startDate, endDate)
            ));
        }
        providers.add(new RemoteHistoryProvider(
                "Yahoo Finance",
                () -> yahooFinanceClient.fetchDailyHistory(symbol, startDate, endDate)
        ));
        providers.add(new RemoteHistoryProvider(
                "Finnhub",
                () -> finnhubClient.fetchDailyHistory(symbol, startDate, endDate)
        ));
        return providers;
    }

    private AssetPriceWindowSnapshot toPriceWindow(Long assetId, List<AssetPriceHistoryItem> items) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        List<AssetPriceHistoryItem> sorted = items.stream()
                .filter(item -> item != null && item.tradeDate() != null && item.close() != null)
                .sorted(Comparator.comparing(AssetPriceHistoryItem::tradeDate))
                .toList();
        if (sorted.isEmpty()) {
            return null;
        }

        AssetPriceHistoryItem latest = sorted.get(sorted.size() - 1);
        AssetPriceHistoryItem previous = sorted.size() > 1 ? sorted.get(sorted.size() - 2) : null;
        return new AssetPriceWindowSnapshot(
                assetId,
                latest.close(),
                latest.tradeDate(),
                previous == null ? null : previous.close(),
                previous == null ? null : previous.tradeDate()
        );
    }

    private WatchlistItem toItem(WatchlistEntity watchlist, AssetPriceWindowSnapshot priceWindow) {
        AssetEntity asset = watchlist.getAsset();
        AssetStockDetailEntity stockDetail = asset.getStockDetail();
        BigDecimal latestClose = priceWindow == null ? null : priceWindow.latestClose();
        BigDecimal dailyChange = resolveDailyChange(priceWindow);
        BigDecimal dailyChangePercent = resolveDailyChangePercent(priceWindow);
        return new WatchlistItem(
                watchlist.getId(),
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
                latestClose,
                priceWindow == null ? null : priceWindow.latestTradeDate(),
                dailyChange,
                dailyChangePercent,
                watchlist.getAddedAt(),
                watchlist.getNote()
        );
    }

    private BigDecimal resolveDailyChange(AssetPriceWindowSnapshot priceWindow) {
        if (priceWindow == null || priceWindow.latestClose() == null || priceWindow.previousClose() == null) {
            return null;
        }
        return priceWindow.latestClose()
                .subtract(priceWindow.previousClose())
                .setScale(6, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveDailyChangePercent(AssetPriceWindowSnapshot priceWindow) {
        BigDecimal dailyChange = resolveDailyChange(priceWindow);
        if (dailyChange == null || priceWindow.previousClose() == null || priceWindow.previousClose().signum() == 0) {
            return null;
        }
        return dailyChange
                .divide(priceWindow.previousClose(), 6, RoundingMode.HALF_UP);
    }

    private record RemoteHistoryProvider(
            String displayName,
            Supplier<List<AssetPriceHistoryItem>> fetcher
    ) {
    }
}
