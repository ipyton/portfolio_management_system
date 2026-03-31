package com.noah.portfolio.scheduler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MarketDataRefreshService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataRefreshService.class);

    private final FxRateRefreshService fxRateRefreshService;

    public MarketDataRefreshService(FxRateRefreshService fxRateRefreshService) {
        this.fxRateRefreshService = fxRateRefreshService;
    }

    public void refreshDailyMarketData() {
        fxRateRefreshService.refreshLatestRates();
        log.info(
            "Market data refresh placeholder triggered. Target tables: asset_price_daily, asset_fund_detail.nav, assets benchmark metadata, fx_rate_latest, fx_rate_history."
        );
    }
}
