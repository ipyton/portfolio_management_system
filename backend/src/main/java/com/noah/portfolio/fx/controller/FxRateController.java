package com.noah.portfolio.fx.controller;

import com.noah.portfolio.fx.config.*;
import com.noah.portfolio.fx.entity.*;
import com.noah.portfolio.fx.repository.*;
import com.noah.portfolio.fx.service.*;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fx")
public class FxRateController {

    private final FxRateService fxRateService;

    public FxRateController(FxRateService fxRateService) {
        this.fxRateService = fxRateService;
    }

    @GetMapping("/latest")
    public Map<String, Object> latest(
            @RequestParam(required = false) String quoteCurrency
    ) {
        return fxRateService.latestSnapshot(quoteCurrency);
    }
}
