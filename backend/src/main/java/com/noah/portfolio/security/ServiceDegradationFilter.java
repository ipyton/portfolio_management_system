package com.noah.portfolio.security;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

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
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ServiceDegradationFilter extends OncePerRequestFilter {

    private final boolean enabled;
    private final List<String> allowPrefixes;
    private final String message;
    private final ErrorResponseWriter errorResponseWriter;

    public ServiceDegradationFilter(
            @Value("${resilience.degradation.enabled:false}") boolean enabled,
            @Value("${resilience.degradation.allow-path-prefixes:/api/health}") String allowPathPrefixes,
            @Value("${resilience.degradation.message:Service is temporarily degraded. Please try again later.}") String message,
            ErrorResponseWriter errorResponseWriter
    ) {
        this.enabled = enabled;
        this.allowPrefixes = Arrays.stream(allowPathPrefixes.split(","))
                .map(String::trim)
                .filter(prefix -> !prefix.isEmpty())
                .toList();
        this.message = message;
        this.errorResponseWriter = errorResponseWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || HttpMethod.OPTIONS.matches(request.getMethod()) || isAllowedPath(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        errorResponseWriter.write(
                request,
                response,
                HttpStatus.SERVICE_UNAVAILABLE,
                "SERVICE_DEGRADED",
                message
        );
    }

    private boolean isAllowedPath(String requestPath) {
        return allowPrefixes.stream().anyMatch(requestPath::startsWith);
    }
}
