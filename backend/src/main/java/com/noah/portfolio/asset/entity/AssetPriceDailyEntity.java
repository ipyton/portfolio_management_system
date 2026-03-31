package com.noah.portfolio.asset.entity;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "asset_price_daily")
public class AssetPriceDailyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private AssetEntity asset;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(precision = 18, scale = 6, nullable = false)
    private BigDecimal close;

    protected AssetPriceDailyEntity() {
    }
}
