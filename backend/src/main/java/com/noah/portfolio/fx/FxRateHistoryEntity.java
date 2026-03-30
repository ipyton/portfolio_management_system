package com.noah.portfolio.fx;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "fx_rate_history")
public class FxRateHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "base_currency", nullable = false, length = 10)
    private String baseCurrency;

    @Column(name = "quote_currency", nullable = false, length = 10)
    private String quoteCurrency;

    @Column(nullable = false, precision = 18, scale = 8)
    private BigDecimal rate;

    @Column(nullable = false, length = 50)
    private String source;

    @Column(length = 50)
    private String symbol;

    @Column(name = "as_of", nullable = false)
    private Instant asOf;

    protected FxRateHistoryEntity() {
    }

    public FxRateHistoryEntity(
            String baseCurrency,
            String quoteCurrency,
            BigDecimal rate,
            String source,
            String symbol,
            Instant asOf
    ) {
        this.baseCurrency = baseCurrency;
        this.quoteCurrency = quoteCurrency;
        this.rate = rate;
        this.source = source;
        this.symbol = symbol;
        this.asOf = asOf;
    }
}
