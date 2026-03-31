package com.noah.portfolio.trading.entity;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

import java.math.BigDecimal;

import com.noah.portfolio.user.entity.UserEntity;

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
@Table(name = "cash_accounts")
public class CashAccountEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal balance;

    @Column(name = "available_balance", nullable = false, precision = 18, scale = 6)
    private BigDecimal availableBalance;

    @Column(name = "frozen_balance", nullable = false, precision = 18, scale = 6)
    private BigDecimal frozenBalance;

    protected CashAccountEntity() {
    }

    public CashAccountEntity(
            UserEntity user,
            String currency,
            BigDecimal availableBalance,
            BigDecimal frozenBalance
    ) {
        this.user = user;
        this.currency = currency;
        setBalances(availableBalance, frozenBalance);
    }

    public Long getId() {
        return id;
    }

    public UserEntity getUser() {
        return user;
    }

    public String getCurrency() {
        return currency;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public BigDecimal getAvailableBalance() {
        return availableBalance;
    }

    public BigDecimal getFrozenBalance() {
        return frozenBalance;
    }

    public void setBalances(BigDecimal availableBalance, BigDecimal frozenBalance) {
        this.availableBalance = availableBalance;
        this.frozenBalance = frozenBalance;
        this.balance = availableBalance.add(frozenBalance);
    }
}
