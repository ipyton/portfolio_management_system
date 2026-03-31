package com.noah.portfolio.asset.dto;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AssetSearchResponse(
        String query,
        String matchedSource,
        String resolvedSymbol,
        DatabaseAssetDetail database,
        YahooFinanceDetail yahooFinance,
        List<AssetCandidate> databaseMatches,
        List<String> warnings
) {
}
