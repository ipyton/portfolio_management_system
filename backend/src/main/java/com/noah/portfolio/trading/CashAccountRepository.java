package com.noah.portfolio.trading;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CashAccountRepository extends JpaRepository<CashAccountEntity, Long> {

    Optional<CashAccountEntity> findByUserIdAndCurrency(Long userId, String currency);
}
