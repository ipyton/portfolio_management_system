package com.noah.portfolio.asset;

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

enum FundType {
    MONEY_MARKET,
    BOND,
    EQUITY,
    MIXED
}
