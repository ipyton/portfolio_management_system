package com.noah.portfolio.asset;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "assets")
public class AssetEntity {

    @Id
    private Long id;

    @Column(nullable = false, length = 30)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false)
    private AssetType assetType;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(length = 20)
    private String exchange;

    @Column(length = 50)
    private String region;

    @Column(name = "is_benchmark", nullable = false)
    private boolean benchmark;

    @OneToOne(mappedBy = "asset", fetch = FetchType.LAZY)
    private AssetStockDetailEntity stockDetail;

    @OneToOne(mappedBy = "asset", fetch = FetchType.LAZY)
    private AssetEtfDetailEntity etfDetail;

    @OneToOne(mappedBy = "asset", fetch = FetchType.LAZY)
    private AssetFundDetailEntity fundDetail;

    @OneToOne(mappedBy = "asset", fetch = FetchType.LAZY)
    private AssetFuturesDetailEntity futuresDetail;

    @OneToOne(mappedBy = "asset", fetch = FetchType.LAZY)
    private AssetCryptoDetailEntity cryptoDetail;

    @OneToOne(mappedBy = "asset", fetch = FetchType.LAZY)
    private AssetBondDetailEntity bondDetail;

    protected AssetEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getSymbol() {
        return symbol;
    }

    public AssetType getAssetType() {
        return assetType;
    }

    public String getName() {
        return name;
    }

    public String getCurrency() {
        return currency;
    }

    public String getExchange() {
        return exchange;
    }

    public String getRegion() {
        return region;
    }

    public boolean isBenchmark() {
        return benchmark;
    }

    public AssetStockDetailEntity getStockDetail() {
        return stockDetail;
    }

    public AssetEtfDetailEntity getEtfDetail() {
        return etfDetail;
    }

    public AssetFundDetailEntity getFundDetail() {
        return fundDetail;
    }

    public AssetFuturesDetailEntity getFuturesDetail() {
        return futuresDetail;
    }

    public AssetCryptoDetailEntity getCryptoDetail() {
        return cryptoDetail;
    }

    public AssetBondDetailEntity getBondDetail() {
        return bondDetail;
    }
}

enum AssetType {
    STOCK,
    ETF,
    FUND,
    FUTURES,
    CRYPTO,
    BOND,
    INDEX
}
