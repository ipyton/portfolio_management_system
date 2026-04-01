package com.noah.portfolio.trading.model;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

public enum OperationStatus {
    PENDING,
    SUCCESS,
    FAILED,
    CANCELED
}
