package com.noah.portfolio.watchlist.service;

import com.noah.portfolio.watchlist.controller.*;
import com.noah.portfolio.watchlist.dto.*;
import com.noah.portfolio.watchlist.entity.*;
import com.noah.portfolio.watchlist.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.model.AssetPriceWindowSnapshot;
import com.noah.portfolio.asset.repository.AssetRepository;
import com.noah.portfolio.asset.repository.AssetSearchDataRepository;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

@Service
@Transactional
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final UserRepository userRepository;
    private final AssetRepository assetRepository;
    private final AssetSearchDataRepository assetSearchDataRepository;

    public WatchlistService(
            WatchlistRepository watchlistRepository,
            UserRepository userRepository,
            AssetRepository assetRepository,
            AssetSearchDataRepository assetSearchDataRepository
    ) {
        this.watchlistRepository = watchlistRepository;
        this.userRepository = userRepository;
        this.assetRepository = assetRepository;
        this.assetSearchDataRepository = assetSearchDataRepository;
    }

    @Transactional(readOnly = true)
    public WatchlistResponse getWatchlist(Long userId) {
        ensureUserExists(userId);
        List<WatchlistEntity> watchlists = watchlistRepository.findByUserIdOrderByAddedAtDesc(userId);
        Map<Long, AssetPriceWindowSnapshot> priceWindows = assetSearchDataRepository.findLatestPriceWindows(
                watchlists.stream().map(item -> item.getAsset().getId()).toList()
        );
        List<WatchlistItem> items = watchlists.stream()
                .map(watchlist -> toItem(watchlist, priceWindows.get(watchlist.getAsset().getId())))
                .toList();
        return new WatchlistResponse(userId, items.size(), items);
    }

    public WatchlistItem addToWatchlist(WatchlistRequest request) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = requireStockAsset(request.assetId());

        watchlistRepository.findByUserIdAndAssetId(request.userId(), request.assetId())
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "The stock is already in the watchlist.");
                });

        WatchlistEntity saved = watchlistRepository.save(new WatchlistEntity(user, asset, request.note()));
        return toItem(saved, assetSearchDataRepository.findLatestPriceWindows(List.of(asset.getId())).get(asset.getId()));
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

    private AssetEntity requireStockAsset(Long assetId) {
        AssetEntity asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found."));
        if (asset.getAssetType() != AssetType.STOCK) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only stocks can be added to the watchlist.");
        }
        return asset;
    }

    private WatchlistItem toItem(WatchlistEntity watchlist, AssetPriceWindowSnapshot priceWindow) {
        AssetEntity asset = watchlist.getAsset();
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
}
