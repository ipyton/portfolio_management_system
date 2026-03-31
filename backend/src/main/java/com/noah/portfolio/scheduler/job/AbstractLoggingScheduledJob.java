package com.noah.portfolio.scheduler.job;

import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;

public abstract class AbstractLoggingScheduledJob {

    protected void runJob(Logger logger, String jobName, Runnable action) {
        Instant startedAt = Instant.now();
        logger.info("Scheduled job [{}] started", jobName);
        try {
            action.run();
            long elapsedMs = Duration.between(startedAt, Instant.now()).toMillis();
            logger.info("Scheduled job [{}] finished in {} ms", jobName, elapsedMs);
        } catch (RuntimeException ex) {
            long elapsedMs = Duration.between(startedAt, Instant.now()).toMillis();
            logger.error("Scheduled job [{}] failed after {} ms", jobName, elapsedMs, ex);
            throw ex;
        }
    }
}
