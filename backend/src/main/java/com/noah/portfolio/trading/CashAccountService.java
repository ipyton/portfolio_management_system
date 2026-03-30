package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.noah.portfolio.user.UserEntity;
import com.noah.portfolio.user.UserRepository;

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
        CashAccountEntity account = findOrCreateCashAccount(user, currency);
        BigDecimal balanceBefore = normalize(account.getBalance());
        BigDecimal balanceAfter = normalize(balanceBefore.add(amount));

        account.setBalance(balanceAfter);
        cashAccountRepository.save(account);
        cashTransactionRepository.save(new CashTransactionEntity(
                user,
                currency,
                CashTransactionType.DEPOSIT,
                amount,
                balanceAfter,
                null,
                resolveNote(request.note(), "Mock deposit")
        ));

        return new CashAccountTransferResponse(
                true,
                CashTransactionType.DEPOSIT.name(),
                user.getId(),
                account.getId(),
                currency,
                amount,
                balanceBefore,
                balanceAfter,
                resolveNote(request.note(), "Mock deposit")
        );
    }

    public CashAccountTransferResponse mockWithdraw(CashAccountTransferRequest request) {
        UserEntity user = requireUser(request.userId());
        String currency = normalizeCurrency(request.currency());
        BigDecimal amount = normalize(request.amount());
        CashAccountEntity account = findOrCreateCashAccount(user, currency);
        BigDecimal balanceBefore = normalize(account.getBalance());

        if (balanceBefore.compareTo(amount) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient cash balance.");
        }

        BigDecimal balanceAfter = normalize(balanceBefore.subtract(amount));
        account.setBalance(balanceAfter);
        cashAccountRepository.save(account);
        cashTransactionRepository.save(new CashTransactionEntity(
                user,
                currency,
                CashTransactionType.WITHDRAW,
                amount.negate(),
                balanceAfter,
                null,
                resolveNote(request.note(), "Mock withdraw")
        ));

        return new CashAccountTransferResponse(
                true,
                CashTransactionType.WITHDRAW.name(),
                user.getId(),
                account.getId(),
                currency,
                amount,
                balanceBefore,
                balanceAfter,
                resolveNote(request.note(), "Mock withdraw")
        );
    }

    @Transactional(readOnly = true)
    public CashAccountBalanceResponse getBalances(Long userId) {
        ensureUserExists(userId);
        List<CashAccountBalanceItem> items = cashAccountRepository.findByUserIdOrderByCurrencyAsc(userId).stream()
                .map(account -> new CashAccountBalanceItem(
                        account.getId(),
                        account.getCurrency(),
                        normalize(account.getBalance())
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
                        tx.getCurrency(),
                        tx.getTxType().name(),
                        normalize(tx.getAmount()),
                        normalize(tx.getBalanceAfter()),
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
                        new CashAccountEntity(user, currency, BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP))
                ));
    }

    private String normalizeCurrency(String currency) {
        if (!StringUtils.hasText(currency)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency must not be blank.");
        }
        return currency.trim().toUpperCase(Locale.ROOT);
    }

    private BigDecimal normalize(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private String resolveNote(String note, String fallback) {
        return StringUtils.hasText(note) ? note.trim() : fallback;
    }
}
