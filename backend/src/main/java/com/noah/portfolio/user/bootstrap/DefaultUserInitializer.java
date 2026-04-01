package com.noah.portfolio.user.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DefaultUserInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DefaultUserInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public DefaultUserInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        Long userCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Long.class);
        if (userCount == null || userCount > 0) {
            return;
        }

        try {
            jdbcTemplate.update(
                    "INSERT INTO users (id, username, email, password_hash) VALUES (1, ?, ?, ?)",
                    "user_1",
                    "user1@local",
                    ""
            );
            log.info("Initialized default empty user row: id=1");
        } catch (DuplicateKeyException ignored) {
            log.info("Default user row already exists, skip initialization.");
        }
    }
}
