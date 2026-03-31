package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "trade_history")
public class TradeHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "biz_id", nullable = false, length = 64)
    private String bizId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "holding_id", nullable = false)
    private HoldingEntity holding;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_type", nullable = false)
    private TradeType tradeType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OperationStatus status;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal amount;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal fee;

    @Column(name = "holding_quantity_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal holdingQuantityAfter;

    @Column(name = "holding_avg_cost_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal holdingAvgCostAfter;

    @Column(name = "traded_at", nullable = false, insertable = false, updatable = false)
    private Instant tradedAt;

    @Column(length = 255)
    private String note;

    protected TradeHistoryEntity() {
    }

    public TradeHistoryEntity(
            String bizId,
            HoldingEntity holding,
            TradeType tradeType,
            OperationStatus status,
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal amount,
            BigDecimal fee,
            BigDecimal holdingQuantityAfter,
            BigDecimal holdingAvgCostAfter,
            String note
    ) {
        this.bizId = bizId;
        this.holding = holding;
        this.tradeType = tradeType;
        this.status = status;
        this.quantity = quantity;
        this.price = price;
        this.amount = amount;
        this.fee = fee;
        this.holdingQuantityAfter = holdingQuantityAfter;
        this.holdingAvgCostAfter = holdingAvgCostAfter;
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public String getBizId() {
        return bizId;
    }

    public HoldingEntity getHolding() {
        return holding;
    }

    public TradeType getTradeType() {
        return tradeType;
    }

    public OperationStatus getStatus() {
        return status;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BigDecimal getFee() {
        return fee;
    }

    public BigDecimal getHoldingQuantityAfter() {
        return holdingQuantityAfter;
    }

    public BigDecimal getHoldingAvgCostAfter() {
        return holdingAvgCostAfter;
    }

    public Instant getTradedAt() {
        return tradedAt;
    }

    public String getNote() {
        return note;
    }
}
