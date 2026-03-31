package com.noah.portfolio.analytics.entity;

import com.noah.portfolio.analytics.controller.*;
import com.noah.portfolio.analytics.repository.*;
import com.noah.portfolio.analytics.service.*;

import java.math.BigDecimal;
import java.time.LocalDate;

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
@Table(name = "portfolio_nav_daily")
public class PortfolioNavDailyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "nav_date", nullable = false)
    private LocalDate navDate;

    @Column(name = "total_value", nullable = false, precision = 18, scale = 6)
    private BigDecimal totalValue;

    @Column(name = "holding_value", nullable = false, precision = 18, scale = 6)
    private BigDecimal holdingValue;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal cash;

    @Column(name = "net_value", nullable = false, precision = 18, scale = 6)
    private BigDecimal netValue;

    @Column(name = "daily_return", precision = 10, scale = 6)
    private BigDecimal dailyReturn;

    protected PortfolioNavDailyEntity() {
    }

    public PortfolioNavDailyEntity(
            UserEntity user,
            LocalDate navDate,
            BigDecimal totalValue,
            BigDecimal holdingValue,
            BigDecimal cash,
            BigDecimal netValue,
            BigDecimal dailyReturn
    ) {
        this.user = user;
        this.navDate = navDate;
        this.totalValue = totalValue;
        this.holdingValue = holdingValue;
        this.cash = cash;
        this.netValue = netValue;
        this.dailyReturn = dailyReturn;
    }

    public Long getId() {
        return id;
    }

    public UserEntity getUser() {
        return user;
    }

    public LocalDate getNavDate() {
        return navDate;
    }

    public BigDecimal getTotalValue() {
        return totalValue;
    }

    public BigDecimal getHoldingValue() {
        return holdingValue;
    }

    public BigDecimal getCash() {
        return cash;
    }

    public BigDecimal getNetValue() {
        return netValue;
    }

    public BigDecimal getDailyReturn() {
        return dailyReturn;
    }

    public void update(
            BigDecimal totalValue,
            BigDecimal holdingValue,
            BigDecimal cash,
            BigDecimal netValue,
            BigDecimal dailyReturn
    ) {
        this.totalValue = totalValue;
        this.holdingValue = holdingValue;
        this.cash = cash;
        this.netValue = netValue;
        this.dailyReturn = dailyReturn;
    }
}
