package com.noah.portfolio.asset;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "asset_etf_detail")
public class AssetEtfDetailEntity {

    @Id
    @Column(name = "asset_id")
    private Long assetId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private AssetEntity asset;

    @Column(name = "fund_family", length = 50)
    private String fundFamily;

    @Column(name = "expense_ratio", precision = 6, scale = 4)
    private BigDecimal expenseRatio;

    @Column(length = 100)
    private String benchmark;

    protected AssetEtfDetailEntity() {
    }

    public String getFundFamily() {
        return fundFamily;
    }

    public BigDecimal getExpenseRatio() {
        return expenseRatio;
    }

    public String getBenchmark() {
        return benchmark;
    }
}
