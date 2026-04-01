package com.noah.portfolio.trading.service;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

@Service
@Transactional
public class CashAccountService {

    private static final int SCALE = 6;

    private final UserRepository userRepository;
    private final CashAccountRepository cashAccountRepository;
    private final CashTransactionRepository cashTransactionRepository;

    public CashAccountService(
            UserRepository userRepository,
            CashAccountRepository cashAccountRepository,
            CashTransactionRepository cashTransactionRepository
    ) {
        this.userRepository = userRepository;
        this.cashAccountRepository = cashAccountRepository;
        this.cashTransactionRepository = cashTransactionRepository;
    }

    public CashAccountTransferResponse mockDeposit(CashAccountTransferRequest request) {
        UserEntity user = requireUser(request.userId());
        String currency = normalizeCurrency(request.currency());
        BigDecimal amount = normalize(request.amount());
        String bizId = requireBizId(request.bizId());
        CashTransactionEntity existing = cashTransactionRepository.findByBizId(bizId).orElse(null);
        if (existing != null) {
            validateExistingCashTransaction(existing, user.getId(), currency, CashTransactionType.DEPOSIT, amount);
            return toTransferResponse(existing, true);
        }

        CashAccountEntity account = findOrCreateCashAccount(user, currency);
        BigDecimal balanceBefore = normalize(account.getBalance());
        BigDecimal availableBefore = normalize(account.getAvailableBalance());
        BigDecimal frozenBefore = normalize(account.getFrozenBalance());
        BigDecimal balanceAfter = normalize(balanceBefore.add(amount));
        BigDecimal availableAfter = normalize(availableBefore.add(amount));

        account.setBalances(availableAfter, frozenBefore);
        cashAccountRepository.save(account);
        CashTransactionEntity tx = cashTransactionRepository.save(new CashTransactionEntity(
                bizId,
                user,
                currency,
                CashTransactionType.DEPOSIT,
                OperationStatus.SUCCESS,
                amount,
                balanceAfter,
                availableAfter,
                frozenBefore,
                null,
                resolveNote(request.note(), "Mock deposit")
        ));

        return toTransferResponse(tx, true);
    }

    public CashAccountTransferResponse mockWithdraw(CashAccountTransferRequest request) {
        UserEntity user = requireUser(request.userId());
        String currency = normalizeCurrency(request.currency());
        BigDecimal amount = normalize(request.amount());
        String bizId = requireBizId(request.bizId());
        CashTransactionEntity existing = cashTransactionRepository.findByBizId(bizId).orElse(null);
        if (existing != null) {
            validateExistingCashTransaction(existing, user.getId(), currency, CashTransactionType.WITHDRAW, amount);
            return toTransferResponse(existing, true);
        }

        CashAccountEntity account = findOrCreateCashAccount(user, currency);
        BigDecimal balanceBefore = normalize(account.getBalance());
        BigDecimal availableBefore = normalize(account.getAvailableBalance());
        BigDecimal frozenBefore = normalize(account.getFrozenBalance());

        if (availableBefore.compareTo(amount) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient cash balance.");
        }

        BigDecimal balanceAfter = normalize(balanceBefore.subtract(amount));
        BigDecimal availableAfter = normalize(availableBefore.subtract(amount));
        account.setBalances(availableAfter, frozenBefore);
        cashAccountRepository.save(account);
        CashTransactionEntity tx = cashTransactionRepository.save(new CashTransactionEntity(
                bizId,
                user,
                currency,
                CashTransactionType.WITHDRAW,
                OperationStatus.SUCCESS,
                amount.negate(),
                balanceAfter,
                availableAfter,
                frozenBefore,
                null,
                resolveNote(request.note(), "Mock withdraw")
        ));

        return toTransferResponse(tx, true);
    }

    @Transactional(readOnly = true)
    public CashAccountBalanceResponse getBalances(Long userId) {
        ensureUserExists(userId);
        List<CashAccountBalanceItem> items = cashAccountRepository.findByUserIdOrderByCurrencyAsc(userId).stream()
                .map(account -> new CashAccountBalanceItem(
                        account.getId(),
                        account.getCurrency(),
                        normalize(account.getBalance()),
                        normalize(account.getAvailableBalance()),
                        normalize(account.getFrozenBalance())
                ))
                .toList();
        return new CashAccountBalanceResponse(userId, items.size(), items);
    }

    @Transactional(readOnly = true)
    public CashTransactionResponse getTransactions(Long userId, String currency) {
        ensureUserExists(userId);
        String normalizedCurrency = StringUtils.hasText(currency) ? normalizeCurrency(currency) : null;
        List<CashTransactionEntity> transactions = normalizedCurrency == null
                ? cashTransactionRepository.findByUserIdOrderByIdDesc(userId)
                : cashTransactionRepository.findByUserIdAndCurrencyOrderByIdDesc(userId, normalizedCurrency);

        List<CashTransactionItem> items = transactions.stream()
                .map(tx -> new CashTransactionItem(
                        tx.getId(),
                        tx.getBizId(),
                        tx.getCurrency(),
                        tx.getTxType().name(),
                        tx.getStatus().name(),
                        normalize(tx.getAmount()),
                        normalize(tx.getBalanceAfter()),
                        normalize(tx.getAvailableBalanceAfter()),
                        normalize(tx.getFrozenBalanceAfter()),
                        tx.getRefTradeId(),
                        tx.getOccurredAt(),
                        tx.getNote()
                ))
                .toList();
        return new CashTransactionResponse(userId, normalizedCurrency, items.size(), items);
    }

    private UserEntity requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
    }

    private CashAccountEntity findOrCreateCashAccount(UserEntity user, String currency) {
        return cashAccountRepository.findByUserIdAndCurrency(user.getId(), currency)
                .orElseGet(() -> cashAccountRepository.save(
                        new CashAccountEntity(
                                user,
                                currency,
                                BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP),
                                BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP)
                        )
                ));
    }

    private CashAccountTransferResponse toTransferResponse(CashTransactionEntity tx, boolean mock) {
        BigDecimal balanceAfter = normalize(tx.getBalanceAfter());
        BigDecimal availableAfter = normalize(tx.getAvailableBalanceAfter());
        BigDecimal frozenAfter = normalize(tx.getFrozenBalanceAfter());
        BigDecimal balanceBefore = normalize(balanceAfter.subtract(tx.getAmount()));
        BigDecimal availableBefore = normalize(availableAfter.subtract(tx.getAmount()));

        return new CashAccountTransferResponse(
                mock,
                tx.getBizId(),
                tx.getTxType().name(),
                tx.getStatus().name(),
                tx.getUser().getId(),
                resolveCashAccountId(tx.getUser().getId(), tx.getCurrency()),
                tx.getCurrency(),
                normalize(tx.getAmount().abs()),
                balanceBefore,
                balanceAfter,
                availableBefore,
                availableAfter,
                frozenAfter,
                frozenAfter,
                tx.getNote()
        );
    }

    private void validateExistingCashTransaction(
            CashTransactionEntity existing,
            Long userId,
            String currency,
            CashTransactionType txType,
            BigDecimal requestedAmount
    ) {
        BigDecimal expectedSignedAmount = txType == CashTransactionType.DEPOSIT
                ? requestedAmount
                : requestedAmount.negate();
        if (!Objects.equals(existing.getUser().getId(), userId)
                || !Objects.equals(existing.getCurrency(), currency)
                || existing.getTxType() != txType
                || normalize(existing.getAmount()).compareTo(expectedSignedAmount) != 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "bizId already exists for a different cash request.");
        }
    }

    private Long resolveCashAccountId(Long userId, String currency) {
        return cashAccountRepository.findByUserIdAndCurrency(userId, currency)
                .map(CashAccountEntity::getId)
                .orElse(null);
    }

    private String normalizeCurrency(String currency) {
        if (!StringUtils.hasText(currency)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency must not be blank.");
        }
        return currency.trim().toUpperCase(Locale.ROOT);
    }

    private String requireBizId(String bizId) {
        if (!StringUtils.hasText(bizId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bizId must not be blank.");
        }
        return bizId.trim();
    }

    private BigDecimal normalize(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private String resolveNote(String note, String fallback) {
        return StringUtils.hasText(note) ? note.trim() : fallback;
    }
}
