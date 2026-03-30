package com.noah.portfolio.scheduler.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "scheduler")
public class SchedulerProperties {

    @NotBlank
    private String zone = "UTC";

    @Valid
    private final Pool pool = new Pool();

    @Valid
    private final Jobs jobs = new Jobs();

    public String getZone() {
        return zone;
    }

    public void setZone(String zone) {
        this.zone = zone;
    }

    public Pool getPool() {
        return pool;
    }

    public Jobs getJobs() {
        return jobs;
    }

    public static class Pool {
        @Min(1)
        private int size = 4;

        @Min(0)
        private int shutdownAwaitTerminationSeconds = 30;

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public int getShutdownAwaitTerminationSeconds() {
            return shutdownAwaitTerminationSeconds;
        }

        public void setShutdownAwaitTerminationSeconds(int shutdownAwaitTerminationSeconds) {
            this.shutdownAwaitTerminationSeconds = shutdownAwaitTerminationSeconds;
        }
    }

    public static class Jobs {
        @Valid
        private final Job marketDataRefresh = new Job(true, "0 0 22 * * MON-FRI");

        @Valid
        private final Job portfolioNavSnapshot = new Job(true, "0 10 22 * * MON-FRI");

        @Valid
        private final Job systemConfigRefresh = new Job(true, "0 0 6 * * MON");

        public Job getMarketDataRefresh() {
            return marketDataRefresh;
        }

        public Job getPortfolioNavSnapshot() {
            return portfolioNavSnapshot;
        }

        public Job getSystemConfigRefresh() {
            return systemConfigRefresh;
        }
    }

    public static class Job {
        private boolean enabled;

        @NotBlank
        private String cron;

        public Job() {
        }

        public Job(boolean enabled, String cron) {
            this.enabled = enabled;
            this.cron = cron;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getCron() {
            return cron;
        }

        public void setCron(String cron) {
            this.cron = cron;
        }
    }
}
