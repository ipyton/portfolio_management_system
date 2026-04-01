package com.noah.portfolio.trading.dto;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record HoldingResponse(
        Long userId,
        int count,
        List<HoldingItem> items
) {
}
