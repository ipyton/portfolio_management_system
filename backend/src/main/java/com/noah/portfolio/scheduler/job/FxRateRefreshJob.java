package com.noah.portfolio.scheduler.job;

import com.noah.portfolio.scheduler.service.FxRateRefreshService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "scheduler.jobs.fx-rate-refresh",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class FxRateRefreshJob extends AbstractLoggingScheduledJob {

    private static final Logger log = LoggerFactory.getLogger(FxRateRefreshJob.class);

    private final FxRateRefreshService fxRateRefreshService;

    public FxRateRefreshJob(FxRateRefreshService fxRateRefreshService) {
        this.fxRateRefreshService = fxRateRefreshService;
    }

    @Scheduled(
        cron = "${scheduler.jobs.fx-rate-refresh.cron}",
        zone = "${scheduler.zone}",
        scheduler = "portfolioTaskScheduler"
    )
    public void execute() {
        runJob(log, "fxRateRefresh", fxRateRefreshService::refreshLatestRates);
    }
}
