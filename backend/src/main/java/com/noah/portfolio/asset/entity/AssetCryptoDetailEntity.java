package com.noah.portfolio.asset.entity;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "asset_crypto_detail")
public class AssetCryptoDetailEntity {

    @Id
    @Column(name = "asset_id")
    private Long assetId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private AssetEntity asset;

    @Column(length = 50)
    private String chain;

    @Column(name = "contract_address", length = 100)
    private String contractAddress;

    @Column(name = "coingecko_id", length = 100)
    private String coingeckoId;

    protected AssetCryptoDetailEntity() {
    }

    public String getChain() {
        return chain;
    }

    public String getContractAddress() {
        return contractAddress;
    }

    public String getCoingeckoId() {
        return coingeckoId;
    }
}
