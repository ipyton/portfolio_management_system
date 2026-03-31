package com.noah.portfolio.scheduler.job;

import com.noah.portfolio.scheduler.service.SystemConfigRefreshService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "scheduler.jobs.system-config-refresh",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class SystemConfigRefreshJob extends AbstractLoggingScheduledJob {

    private static final Logger log = LoggerFactory.getLogger(SystemConfigRefreshJob.class);

    private final SystemConfigRefreshService systemConfigRefreshService;

    public SystemConfigRefreshJob(SystemConfigRefreshService systemConfigRefreshService) {
        this.systemConfigRefreshService = systemConfigRefreshService;
    }

    @Scheduled(
        cron = "${scheduler.jobs.system-config-refresh.cron}",
        zone = "${scheduler.zone}",
        scheduler = "portfolioTaskScheduler"
    )
    public void execute() {
        runJob(log, "systemConfigRefresh", systemConfigRefreshService::refreshDerivedConfigs);
    }
}
