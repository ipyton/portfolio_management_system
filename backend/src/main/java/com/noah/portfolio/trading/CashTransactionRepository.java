package com.noah.portfolio.trading;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CashTransactionRepository extends JpaRepository<CashTransactionEntity, Long> {

    List<CashTransactionEntity> findByUserIdOrderByIdDesc(Long userId);

    List<CashTransactionEntity> findByUserIdAndCurrencyOrderByIdDesc(Long userId, String currency);
}
