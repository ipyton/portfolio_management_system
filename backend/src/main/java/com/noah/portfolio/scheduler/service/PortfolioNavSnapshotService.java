package com.noah.portfolio.scheduler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PortfolioNavSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioNavSnapshotService.class);

    public void buildDailySnapshots() {
        log.info(
            "Portfolio NAV snapshot placeholder triggered. Target table: portfolio_nav_daily. Inputs: holdings, cash_accounts, asset_price_daily."
        );
    }
}
