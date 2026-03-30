package com.noah.portfolio.trading;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CashTransactionRepository extends JpaRepository<CashTransactionEntity, Long> {

    Optional<CashTransactionEntity> findByBizId(String bizId);

    Optional<CashTransactionEntity> findFirstByRefTradeIdOrderByIdDesc(Long refTradeId);

    List<CashTransactionEntity> findByUserIdOrderByIdDesc(Long userId);

    List<CashTransactionEntity> findByUserIdAndCurrencyOrderByIdDesc(Long userId, String currency);
}
