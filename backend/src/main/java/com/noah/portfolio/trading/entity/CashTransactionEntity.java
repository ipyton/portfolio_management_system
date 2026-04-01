package com.noah.portfolio.trading.entity;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

import java.math.BigDecimal;
import java.time.Instant;

import com.noah.portfolio.user.entity.UserEntity;

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
@Table(name = "cash_transactions")
public class CashTransactionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "biz_id", nullable = false, length = 64)
    private String bizId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 10)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "tx_type", nullable = false)
    private CashTransactionType txType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OperationStatus status;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal balanceAfter;

    @Column(name = "available_balance_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal availableBalanceAfter;

    @Column(name = "frozen_balance_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal frozenBalanceAfter;

    @Column(name = "ref_trade_id")
    private Long refTradeId;

    @Column(name = "occurred_at", nullable = false, insertable = false, updatable = false)
    private Instant occurredAt;

    @Column(length = 255)
    private String note;

    protected CashTransactionEntity() {
    }

    public CashTransactionEntity(
            String bizId,
            UserEntity user,
            String currency,
            CashTransactionType txType,
            OperationStatus status,
            BigDecimal amount,
            BigDecimal balanceAfter,
            BigDecimal availableBalanceAfter,
            BigDecimal frozenBalanceAfter,
            Long refTradeId,
            String note
    ) {
        this.bizId = bizId;
        this.user = user;
        this.currency = currency;
        this.txType = txType;
        this.status = status;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.availableBalanceAfter = availableBalanceAfter;
        this.frozenBalanceAfter = frozenBalanceAfter;
        this.refTradeId = refTradeId;
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public String getBizId() {
        return bizId;
    }

    public UserEntity getUser() {
        return user;
    }

    public String getCurrency() {
        return currency;
    }

    public CashTransactionType getTxType() {
        return txType;
    }

    public OperationStatus getStatus() {
        return status;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }

    public BigDecimal getAvailableBalanceAfter() {
        return availableBalanceAfter;
    }

    public BigDecimal getFrozenBalanceAfter() {
        return frozenBalanceAfter;
    }

    public Long getRefTradeId() {
        return refTradeId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getNote() {
        return note;
    }
}
