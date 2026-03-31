package com.noah.portfolio.trading.controller;

import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

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
@RequestMapping("/api/cash-accounts")
@Tag(name = "Cash Accounts", description = "Mock cash account deposit and withdraw APIs")
public class CashAccountController {

    private final CashAccountService cashAccountService;

    public CashAccountController(CashAccountService cashAccountService) {
        this.cashAccountService = cashAccountService;
    }

    @GetMapping
    @Operation(summary = "Get cash balances", description = "Returns all cash account balances for a user.")
    public CashAccountBalanceResponse getBalances(
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId
    ) {
        return cashAccountService.getBalances(userId);
    }

    @GetMapping("/transactions")
    @Operation(summary = "Get cash transactions", description = "Returns cash transaction history for a user, optionally filtered by currency.")
    public CashTransactionResponse getTransactions(
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId,
            @Parameter(description = "Optional currency filter", example = "USD")
            @RequestParam(required = false) String currency
    ) {
        return cashAccountService.getTransactions(userId, currency);
    }

    @PostMapping("/deposit")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Mock deposit", description = "Mocks a cash deposit by directly increasing the local cash account balance.")
    public CashAccountTransferResponse deposit(@Valid @RequestBody CashAccountTransferRequest request) {
        return cashAccountService.mockDeposit(request);
    }

    @PostMapping("/withdraw")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Mock withdraw", description = "Mocks a cash withdrawal by directly decreasing the local cash account balance.")
    public CashAccountTransferResponse withdraw(@Valid @RequestBody CashAccountTransferRequest request) {
        return cashAccountService.mockWithdraw(request);
    }
}
