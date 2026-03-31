package com.noah.portfolio.security;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import com.noah.portfolio.common.ErrorResponseWriter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestKeyFilter extends OncePerRequestFilter {

    private final String headerName;
    private final String expectedValue;
    private final ErrorResponseWriter errorResponseWriter;

    public RequestKeyFilter(
            @Value("${security.request-key.header-name}") String headerName,
            @Value("${security.request-key.value}") String expectedValue,
            ErrorResponseWriter errorResponseWriter
    ) {
        this.headerName = headerName;
        this.expectedValue = expectedValue;
        this.errorResponseWriter = errorResponseWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return HttpMethod.OPTIONS.matches(request.getMethod()) || isDocumentationPath(request.getRequestURI());
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

        errorResponseWriter.write(
                request,
                response,
                HttpStatus.FORBIDDEN,
                "FORBIDDEN",
                "Invalid or missing request key"
        );
    }

    private boolean isAuthorized(String requestKey) {
        if (!StringUtils.hasText(requestKey) || !StringUtils.hasText(expectedValue)) {
            return false;
        }
        return requestKey.equals(expectedValue);
    }

    private boolean isDocumentationPath(String requestPath) {
        return requestPath.startsWith("/swagger-ui")
                || requestPath.equals("/swagger-ui.html")
                || requestPath.startsWith("/v3/api-docs");
    }
}
