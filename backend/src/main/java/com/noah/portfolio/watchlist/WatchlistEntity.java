package com.noah.portfolio.watchlist;

import java.time.Instant;

import com.noah.portfolio.asset.AssetEntity;
import com.noah.portfolio.user.UserEntity;

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
@Table(name = "watchlist")
public class WatchlistEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private AssetEntity asset;

    @Column(name = "added_at", nullable = false, insertable = false, updatable = false)
    private Instant addedAt;

    @Column(length = 255)
    private String note;

    protected WatchlistEntity() {
    }

    public WatchlistEntity(UserEntity user, AssetEntity asset, String note) {
        this.user = user;
        this.asset = asset;
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public UserEntity getUser() {
        return user;
    }

    public AssetEntity getAsset() {
        return asset;
    }

    public Instant getAddedAt() {
        return addedAt;
    }

    public String getNote() {
        return note;
    }
}
