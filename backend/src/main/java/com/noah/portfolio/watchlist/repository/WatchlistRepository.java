package com.noah.portfolio.watchlist.repository;

import com.noah.portfolio.watchlist.controller.*;
import com.noah.portfolio.watchlist.dto.*;
import com.noah.portfolio.watchlist.entity.*;
import com.noah.portfolio.watchlist.service.*;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WatchlistRepository extends JpaRepository<WatchlistEntity, Long> {

    List<WatchlistEntity> findByUserIdOrderByAddedAtDesc(Long userId);

    Optional<WatchlistEntity> findByUserIdAndAssetId(Long userId, Long assetId);
}
