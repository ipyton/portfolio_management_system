package com.noah.portfolio.scheduler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SystemConfigRefreshService {

    private static final Logger log = LoggerFactory.getLogger(SystemConfigRefreshService.class);

    public void refreshDerivedConfigs() {
        log.info(
            "System config refresh placeholder triggered. Candidate table: system_config for risk-free rate or other external reference parameters."
        );
    }
}
