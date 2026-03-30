package com.noah.portfolio.trading;

import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@Validated
@RequestMapping("/api/trades")
@Tag(name = "Trading", description = "Stock buy and sell APIs")
public class TradingController {

    private final TradingService tradingService;

    public TradingController(TradingService tradingService) {
        this.tradingService = tradingService;
    }

    @GetMapping("/history")
    @Operation(summary = "Get trade history", description = "Returns all trade records for a user.")
    public TradeHistoryResponse getTradeHistory(
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId
    ) {
        return tradingService.getTradeHistory(userId);
    }

    @PostMapping("/preview-buy")
    @Operation(summary = "Preview buy trade", description = "Calculates the cash impact of a buy trade without persisting anything.")
    public TradePreviewResponse previewBuy(@Valid @RequestBody TradeRequest request) {
        return tradingService.previewBuy(request);
    }

    @PostMapping("/preview-sell")
    @Operation(summary = "Preview sell trade", description = "Calculates the cash impact of a sell trade without persisting anything.")
    public TradePreviewResponse previewSell(@Valid @RequestBody TradeRequest request) {
        return tradingService.previewSell(request);
    }

    @PostMapping("/buy")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Buy stock", description = "Creates a buy trade, updates holdings, and deducts cash balance.")
    public TradeResponse buy(@Valid @RequestBody TradeRequest request) {
        return tradingService.buy(request);
    }

    @PostMapping("/sell")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Sell stock", description = "Creates a sell trade, updates holdings, and credits cash balance.")
    public TradeResponse sell(@Valid @RequestBody TradeRequest request) {
        return tradingService.sell(request);
    }
}
