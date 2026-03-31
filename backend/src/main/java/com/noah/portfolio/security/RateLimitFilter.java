package com.noah.portfolio.security;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.noah.portfolio.common.ErrorResponseWriter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RateLimitFilter extends OncePerRequestFilter {

    private final boolean enabled;
    private final int maxRequests;
    private final long windowMillis;
    private final ErrorResponseWriter errorResponseWriter;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();
    private final AtomicLong totalRequests = new AtomicLong();

    public RateLimitFilter(
            @Value("${resilience.rate-limit.enabled:true}") boolean enabled,
            @Value("${resilience.rate-limit.max-requests:60}") int maxRequests,
            @Value("${resilience.rate-limit.window-seconds:60}") long windowSeconds,
            ErrorResponseWriter errorResponseWriter
    ) {
        this.enabled = enabled;
        this.maxRequests = maxRequests;
        this.windowMillis = windowSeconds * 1000;
        this.errorResponseWriter = errorResponseWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String clientId = resolveClientId(request);
        long now = Instant.now().toEpochMilli();
        WindowCounter counter = counters.compute(clientId, (key, existing) -> refreshCounter(existing, now));
        int currentCount = counter.requestCount().incrementAndGet();

        if (shouldCleanup()) {
            cleanupExpiredCounters(now);
        }

        if (currentCount > maxRequests) {
            errorResponseWriter.write(
                    request,
                    response,
                    HttpStatus.TOO_MANY_REQUESTS,
                    "RATE_LIMITED",
                    "Too many requests. Please try again later."
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientId(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private WindowCounter refreshCounter(WindowCounter existing, long now) {
        if (existing == null || now - existing.windowStartMillis() >= windowMillis) {
            return new WindowCounter(now, new AtomicInteger());
        }
        return existing;
    }

    private boolean shouldCleanup() {
        return totalRequests.incrementAndGet() % 100 == 0;
    }

    private void cleanupExpiredCounters(long now) {
        counters.entrySet().removeIf(entry -> now - entry.getValue().windowStartMillis() >= windowMillis * 2);
    }

    private record WindowCounter(long windowStartMillis, AtomicInteger requestCount) {
    }
}
