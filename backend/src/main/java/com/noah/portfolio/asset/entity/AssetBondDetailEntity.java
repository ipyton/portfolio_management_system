package com.noah.portfolio.asset.entity;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import java.math.BigDecimal;
import java.time.LocalDate;

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
@Table(name = "asset_bond_detail")
public class AssetBondDetailEntity {

    @Id
    @Column(name = "asset_id")
    private Long assetId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private AssetEntity asset;

    @Column(length = 100, nullable = false)
    private String issuer;

    @Enumerated(EnumType.STRING)
    @Column(name = "bond_type")
    private BondType bondType;

    @Column(name = "face_value", precision = 18, scale = 6, nullable = false)
    private BigDecimal faceValue;

    @Column(name = "coupon_rate", precision = 6, scale = 4, nullable = false)
    private BigDecimal couponRate;

    @Column(name = "maturity_date", nullable = false)
    private LocalDate maturityDate;

    protected AssetBondDetailEntity() {
    }

    public String getIssuer() {
        return issuer;
    }

    public BondType getBondType() {
        return bondType;
    }

    public BigDecimal getFaceValue() {
        return faceValue;
    }

    public BigDecimal getCouponRate() {
        return couponRate;
    }

    public LocalDate getMaturityDate() {
        return maturityDate;
    }
}
