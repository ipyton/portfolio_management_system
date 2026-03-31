package com.noah.portfolio.scheduler.job;

import com.noah.portfolio.scheduler.service.MarketDataRefreshService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "scheduler.jobs.market-data-refresh",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class MarketDataRefreshJob extends AbstractLoggingScheduledJob {

    private static final Logger log = LoggerFactory.getLogger(MarketDataRefreshJob.class);

    private final MarketDataRefreshService marketDataRefreshService;

    public MarketDataRefreshJob(MarketDataRefreshService marketDataRefreshService) {
        this.marketDataRefreshService = marketDataRefreshService;
    }

    @Scheduled(
        cron = "${scheduler.jobs.market-data-refresh.cron}",
        zone = "${scheduler.zone}",
        scheduler = "portfolioTaskScheduler"
    )
    public void execute() {
        runJob(log, "marketDataRefresh", marketDataRefreshService::refreshDailyMarketData);
    }
}
