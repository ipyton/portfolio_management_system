package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.time.Instant;

import com.noah.portfolio.user.UserEntity;

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 10)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "tx_type", nullable = false)
    private CashTransactionType txType;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal balanceAfter;

    @Column(name = "ref_trade_id")
    private Long refTradeId;

    @Column(name = "occurred_at", nullable = false, insertable = false, updatable = false)
    private Instant occurredAt;

    @Column(length = 255)
    private String note;

    protected CashTransactionEntity() {
    }

    public CashTransactionEntity(
            UserEntity user,
            String currency,
            CashTransactionType txType,
            BigDecimal amount,
            BigDecimal balanceAfter,
            Long refTradeId,
            String note
    ) {
        this.user = user;
        this.currency = currency;
        this.txType = txType;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.refTradeId = refTradeId;
        this.note = note;
    }
}

enum CashTransactionType {
    DEPOSIT,
    WITHDRAW,
    BUY,
    SELL,
    FEE,
    DIVIDEND
}
