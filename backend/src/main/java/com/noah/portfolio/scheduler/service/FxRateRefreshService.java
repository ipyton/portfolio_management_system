package com.noah.portfolio.scheduler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.noah.portfolio.fx.service.FxRateService;

@Service
public class FxRateRefreshService {

    private static final Logger log = LoggerFactory.getLogger(FxRateRefreshService.class);

    private final FxRateService fxRateService;

    public FxRateRefreshService(FxRateService fxRateService) {
        this.fxRateService = fxRateService;
    }

    public void refreshLatestRates() {
        int refreshed = fxRateService.refreshLatestRates();
        log.info("FX refresh completed. {} currency pairs updated.", refreshed);
    }
}
