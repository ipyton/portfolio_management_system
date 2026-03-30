package com.noah.portfolio.trading;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HoldingRepository extends JpaRepository<HoldingEntity, Long> {

    Optional<HoldingEntity> findByUserIdAndAssetId(Long userId, Long assetId);

    List<HoldingEntity> findByUserIdOrderByIdDesc(Long userId);
}
