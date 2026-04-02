package com.noah.portfolio.asset.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "asset_candle_cache")
public class AssetCandleCacheEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String symbol;

    @Column(name = "candle_interval", nullable = false, length = 10)
    private String candleInterval;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(precision = 18, scale = 6, nullable = false)
    private BigDecimal open;

    @Column(precision = 18, scale = 6, nullable = false)
    private BigDecimal high;

    @Column(precision = 18, scale = 6, nullable = false)
    private BigDecimal low;

    @Column(precision = 18, scale = 6, nullable = false)
    private BigDecimal close;

    @Column(length = 30)
    private String source;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AssetCandleCacheEntity() {
    }

    public AssetCandleCacheEntity(
            String symbol,
            String candleInterval,
            LocalDate tradeDate,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            String source,
            Instant updatedAt
    ) {
        this.symbol = symbol;
        this.candleInterval = candleInterval;
        this.tradeDate = tradeDate;
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.source = source;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public String getSymbol() {
        return symbol;
    }

    public String getCandleInterval() {
        return candleInterval;
    }

    public LocalDate getTradeDate() {
        return tradeDate;
    }

    public BigDecimal getOpen() {
        return open;
    }

    public BigDecimal getHigh() {
        return high;
    }

    public BigDecimal getLow() {
        return low;
    }

    public BigDecimal getClose() {
        return close;
    }

    public String getSource() {
        return source;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void updateFrom(
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            String source,
            Instant updatedAt
    ) {
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.source = source;
        this.updatedAt = updatedAt;
    }
}
