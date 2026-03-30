package com.noah.portfolio.trading;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CashTransactionRepository extends JpaRepository<CashTransactionEntity, Long> {
}
