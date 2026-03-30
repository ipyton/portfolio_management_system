package com.noah.portfolio.scheduler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MarketDataRefreshService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataRefreshService.class);

    public void refreshDailyMarketData() {
        log.info(
            "Market data refresh placeholder triggered. Target tables: asset_price_daily, asset_fund_detail.nav, assets benchmark metadata when needed."
        );
    }
}
