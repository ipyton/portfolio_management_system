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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "holding_id", nullable = false)
    private HoldingEntity holding;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_type", nullable = false)
    private TradeType tradeType;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal amount;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal fee;

    @Column(name = "traded_at", nullable = false, insertable = false, updatable = false)
    private Instant tradedAt;

    @Column(length = 255)
    private String note;

    protected TradeHistoryEntity() {
    }

    public TradeHistoryEntity(
            HoldingEntity holding,
            TradeType tradeType,
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal amount,
            BigDecimal fee,
            String note
    ) {
        this.holding = holding;
        this.tradeType = tradeType;
        this.quantity = quantity;
        this.price = price;
        this.amount = amount;
        this.fee = fee;
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public HoldingEntity getHolding() {
        return holding;
    }

    public TradeType getTradeType() {
        return tradeType;
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

    public Instant getTradedAt() {
        return tradedAt;
    }

    public String getNote() {
        return note;
    }
}

enum TradeType {
    BUY,
    SELL
}
