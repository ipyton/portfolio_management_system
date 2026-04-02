package com.noah.portfolio.asset.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "twelve-data")
public class TwelveDataProperties {

    private boolean enabled = true;
    private String baseUrl = "https://api.twelvedata.com";
    private Duration timeout = Duration.ofSeconds(5);
    private String apiKey = "";
    private List<String> apiKeys = new ArrayList<>();
    private int maxRequestsPerMinute = 6;
    private Duration rateLimitCooldown = Duration.ofSeconds(65);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public Duration getTimeout() {
        return timeout;
    }

    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public List<String> getApiKeys() {
        return apiKeys;
    }

    public void setApiKeys(List<String> apiKeys) {
        this.apiKeys = apiKeys;
    }

    public int getMaxRequestsPerMinute() {
        return maxRequestsPerMinute;
    }

    public void setMaxRequestsPerMinute(int maxRequestsPerMinute) {
        this.maxRequestsPerMinute = maxRequestsPerMinute;
    }

    public Duration getRateLimitCooldown() {
        return rateLimitCooldown;
    }

    public void setRateLimitCooldown(Duration rateLimitCooldown) {
        this.rateLimitCooldown = rateLimitCooldown;
    }

    public List<String> resolveApiKeys() {
        Set<String> deduplicated = new LinkedHashSet<>();
        appendNormalizedKeys(deduplicated, apiKeys);
        if (apiKey != null) {
            appendNormalizedKeys(deduplicated, List.of(apiKey));
        }
        return List.copyOf(deduplicated);
    }

    private void appendNormalizedKeys(Set<String> target, List<String> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        for (String candidate : candidates) {
            if (!StringUtils.hasText(candidate)) {
                continue;
            }
            String[] parts = candidate.split(",");
            for (String part : parts) {
                if (!StringUtils.hasText(part)) {
                    continue;
                }
                target.add(part.trim());
            }
        }
    }
}
