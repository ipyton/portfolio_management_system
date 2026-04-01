package com.noah.portfolio.scheduler.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class SchedulerConfig {

    @Bean(name = "portfolioTaskScheduler")
    public ThreadPoolTaskScheduler portfolioTaskScheduler(SchedulerProperties schedulerProperties) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(schedulerProperties.getPool().getSize());
        scheduler.setThreadNamePrefix("portfolio-scheduler-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(
            schedulerProperties.getPool().getShutdownAwaitTerminationSeconds()
        );
        scheduler.setErrorHandler(
            throwable -> org.slf4j.LoggerFactory.getLogger(SchedulerConfig.class)
                .error("Scheduled task execution failed", throwable)
        );
        scheduler.initialize();
        return scheduler;
    }
}
