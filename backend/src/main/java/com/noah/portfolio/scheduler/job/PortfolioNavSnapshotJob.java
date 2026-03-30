package com.noah.portfolio.scheduler.job;

import com.noah.portfolio.scheduler.service.PortfolioNavSnapshotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "scheduler.jobs.portfolio-nav-snapshot",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class PortfolioNavSnapshotJob extends AbstractLoggingScheduledJob {

    private static final Logger log = LoggerFactory.getLogger(PortfolioNavSnapshotJob.class);

    private final PortfolioNavSnapshotService portfolioNavSnapshotService;

    public PortfolioNavSnapshotJob(PortfolioNavSnapshotService portfolioNavSnapshotService) {
        this.portfolioNavSnapshotService = portfolioNavSnapshotService;
    }

    @Scheduled(
        cron = "${scheduler.jobs.portfolio-nav-snapshot.cron}",
        zone = "${scheduler.zone}",
        scheduler = "portfolioTaskScheduler"
    )
    public void execute() {
        runJob(log, "portfolioNavSnapshot", portfolioNavSnapshotService::buildDailySnapshots);
    }
}
