package com.noah.portfolio.watchlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WatchlistRepository extends JpaRepository<WatchlistEntity, Long> {

    List<WatchlistEntity> findByUserIdOrderByAddedAtDesc(Long userId);

    Optional<WatchlistEntity> findByUserIdAndAssetId(Long userId, Long assetId);
}
