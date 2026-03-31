package com.noah.portfolio.asset.repository;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.service.*;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetRepository extends JpaRepository<AssetEntity, Long> {

    @Query("""
            select distinct a
            from AssetEntity a
            left join fetch a.stockDetail
            where a.assetType = com.noah.portfolio.asset.model.AssetType.STOCK
                and (
                    lower(a.symbol) like concat('%', lower(:keyword), '%')
                    or lower(a.name) like concat('%', lower(:keyword), '%')
                )
            order by case
                when lower(a.symbol) = lower(:keyword) then 0
                when lower(a.symbol) like concat(lower(:keyword), '%') then 1
                when lower(a.name) like concat(lower(:keyword), '%') then 2
                else 3
            end,
            a.symbol asc
            """)
    List<AssetEntity> searchStocks(@Param("keyword") String keyword);
}
