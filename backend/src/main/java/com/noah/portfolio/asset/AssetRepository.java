package com.noah.portfolio.asset;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetRepository extends JpaRepository<AssetEntity, Long> {

    @Query("""
            select distinct a
            from AssetEntity a
            left join fetch a.stockDetail
            where a.assetType = com.noah.portfolio.asset.AssetType.STOCK
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
