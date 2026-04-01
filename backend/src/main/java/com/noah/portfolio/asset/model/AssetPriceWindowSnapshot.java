package com.noah.portfolio.asset.model;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AssetPriceWindowSnapshot(
        Long assetId,
        BigDecimal latestClose,
        LocalDate latestTradeDate,
        BigDecimal previousClose,
        LocalDate previousTradeDate
) {
}
