package com.noah.portfolio.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestKeyFilter extends OncePerRequestFilter {

    private final String headerName;
    private final String expectedValue;

    public RequestKeyFilter(
            @Value("${security.request-key.header-name}") String headerName,
            @Value("${security.request-key.value}") String expectedValue
    ) {
        this.headerName = headerName;
        this.expectedValue = expectedValue;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String requestKey = request.getHeader(headerName);
        if (isAuthorized(requestKey)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("""
                {"code":"FORBIDDEN","message":"Invalid or missing request key"}
                """.trim());
    }

    private boolean isAuthorized(String requestKey) {
        if (!StringUtils.hasText(requestKey) || !StringUtils.hasText(expectedValue)) {
            return false;
        }
        return requestKey.equals(expectedValue);
    }
}
