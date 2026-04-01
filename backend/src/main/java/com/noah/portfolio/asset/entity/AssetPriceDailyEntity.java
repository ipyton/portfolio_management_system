package com.noah.portfolio.asset.entity;

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

    public AssetPriceDailyEntity(AssetEntity asset, LocalDate tradeDate, BigDecimal close) {
        this.asset = asset;
        this.tradeDate = tradeDate;
        this.close = close;
    }

    public Long getId() {
        return id;
    }

    public AssetEntity getAsset() {
        return asset;
    }

    public LocalDate getTradeDate() {
        return tradeDate;
    }

    public BigDecimal getClose() {
        return close;
    }
}
