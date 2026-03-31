package com.noah.portfolio.trading.repository;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.service.*;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CashAccountRepository extends JpaRepository<CashAccountEntity, Long> {

    Optional<CashAccountEntity> findByUserIdAndCurrency(Long userId, String currency);

    List<CashAccountEntity> findByUserIdOrderByCurrencyAsc(Long userId);
}
