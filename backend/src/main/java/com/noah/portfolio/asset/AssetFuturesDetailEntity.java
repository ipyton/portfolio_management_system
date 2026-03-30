package com.noah.portfolio.asset;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "asset_futures_detail")
public class AssetFuturesDetailEntity {

    @Id
    @Column(name = "asset_id")
    private Long assetId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private AssetEntity asset;

    @Column(length = 50, nullable = false)
    private String underlying;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "contract_size", precision = 18, scale = 6, nullable = false)
    private BigDecimal contractSize;

    @Column(name = "margin_rate", precision = 6, scale = 4)
    private BigDecimal marginRate;

    protected AssetFuturesDetailEntity() {
    }

    public String getUnderlying() {
        return underlying;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public BigDecimal getContractSize() {
        return contractSize;
    }

    public BigDecimal getMarginRate() {
        return marginRate;
    }
}
