package com.noah.portfolio.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

@Configuration
public class OpenApiConfig {

    private static final String REQUEST_KEY_SCHEME = "requestKey";

    @Bean
    public OpenAPI portfolioManagementOpenApi(
            @Value("${security.request-key.header-name}") String requestKeyHeaderName
    ) {
        return new OpenAPI()
                .info(new Info()
                        .title("Portfolio Management API")
                        .version("v1")
                        .description("Portfolio management backend APIs, including health checks, analytics, and asset search."))
                .components(new Components().addSecuritySchemes(
                        REQUEST_KEY_SCHEME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name(requestKeyHeaderName)
                                .description("Required request key header for protected APIs.")
                ))
                .addSecurityItem(new SecurityRequirement().addList(REQUEST_KEY_SCHEME));
    }
}
