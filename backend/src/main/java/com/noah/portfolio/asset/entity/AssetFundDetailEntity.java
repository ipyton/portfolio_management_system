package com.noah.portfolio.asset.entity;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "asset_fund_detail")
public class AssetFundDetailEntity {

    @Id
    @Column(name = "asset_id")
    private Long assetId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private AssetEntity asset;

    @Column(name = "fund_family", length = 50)
    private String fundFamily;

    @Enumerated(EnumType.STRING)
    @Column(name = "fund_type")
    private FundType fundType;

    @Column(name = "expense_ratio", precision = 6, scale = 4)
    private BigDecimal expenseRatio;

    @Column(precision = 18, scale = 6)
    private BigDecimal nav;

    protected AssetFundDetailEntity() {
    }

    public String getFundFamily() {
        return fundFamily;
    }

    public FundType getFundType() {
        return fundType;
    }

    public BigDecimal getExpenseRatio() {
        return expenseRatio;
    }

    public BigDecimal getNav() {
        return nav;
    }
}
