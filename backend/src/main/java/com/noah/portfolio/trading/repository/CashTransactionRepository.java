package com.noah.portfolio.trading.repository;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.service.*;

import java.util.List;
import java.util.Optional;
import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashTransactionRepository extends JpaRepository<CashTransactionEntity, Long> {

    Optional<CashTransactionEntity> findByBizId(String bizId);

    Optional<CashTransactionEntity> findFirstByRefTradeIdOrderByIdDesc(Long refTradeId);

    List<CashTransactionEntity> findByUserIdOrderByIdDesc(Long userId);

    List<CashTransactionEntity> findByUserIdAndCurrencyOrderByIdDesc(Long userId, String currency);

    @Query("""
            select tx
            from CashTransactionEntity tx
            where tx.user.id = :userId
                and tx.status = com.noah.portfolio.trading.model.OperationStatus.SUCCESS
                and tx.txType in :txTypes
                and tx.occurredAt >= :startInclusive
                and tx.occurredAt < :endExclusive
            order by tx.occurredAt asc, tx.id asc
            """)
    List<CashTransactionEntity> findSuccessfulTransactionsInWindow(
            @Param("userId") Long userId,
            @Param("txTypes") List<CashTransactionType> txTypes,
            @Param("startInclusive") Instant startInclusive,
            @Param("endExclusive") Instant endExclusive
    );
}
