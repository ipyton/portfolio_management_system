import React from "react";

export default function TradeModals({
  tradeModal,
  setTradeModal,
  selected,
  tradeAmount,
  setTradeAmount,
  tradeCashAmount,
  setTradeCashAmount,
  cashBalanceDisplay,
  isOverBalance,
  isOverHolding,
  stockCashValueDisplay,
  calculatedCashDisplay,
  confirmation,
  setConfirmation,
  onConfirmTrade,
  tradeSubmitting,
  interactionDisabled,
}) {
  const hasInput = Boolean(tradeAmount) || Boolean(tradeCashAmount);
  const disableSubmit =
    !hasInput
    || isOverBalance
    || isOverHolding
    || tradeSubmitting
    || interactionDisabled;

  return (
    <>
      {tradeModal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div
            className={`modal-card trade-modal ${
              tradeModal.type === "buy" ? "is-buy" : "is-sell"
            }`}
          >
            <div className="modal-title-row">
              <h3>{tradeModal.type === "buy" ? "Buy" : "Sell"} Order</h3>
              <span className="modal-side-pill">
                {tradeModal.type === "buy" ? "BUY" : "SELL"}
              </span>
            </div>
            {selected?.symbol && (
              <p className="modal-symbol">
                {selected.symbol} · {selected.name || selected.type || "Asset"}
              </p>
            )}
            {interactionDisabled && (
              <div className="modal-warning">
                Guest mode cannot submit trades. Switch to Logged in to continue.
              </div>
            )}
            {tradeModal.type === "buy" && isOverBalance && (
              <div className="modal-warning">
                Please enter an amount less than your available cash.
              </div>
            )}
            {tradeModal.type === "sell" && isOverHolding && (
              <div className="modal-warning">
                Please enter an amount less than your holding amount.
              </div>
            )}
            {tradeModal.type === "buy" && (
              <p className="modal-cash">
                Cash Available: {cashBalanceDisplay || "N/A"}
              </p>
            )}
            {tradeModal.type === "sell" && selected?.type === "Stock" && (
              <p className="modal-cash">
                Shares Owned: {selected.holdingShares || 0} · Value: {stockCashValueDisplay || "N/A"}
              </p>
            )}
            <label className="modal-label" htmlFor="trade-amount">
              Share Amount
            </label>
            <input
              className="modal-input"
              id="trade-amount"
              type="text"
              min="0"
              step="any"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="Enter amount"
              value={tradeAmount}
              disabled={Boolean(tradeCashAmount) || tradeSubmitting || interactionDisabled}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^0-9.]/g, "");
                const sanitized = nextValue.replace(/(\..*)\./g, "$1");
                setTradeAmount(sanitized);
                if (sanitized) {
                  setTradeCashAmount("");
                }
              }}
            />
            <label className="modal-label" htmlFor="trade-cash">
              Cash Amount
            </label>
            <input
              className="modal-input"
              id="trade-cash"
              type="text"
              min="0"
              step="any"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="Enter cash amount"
              value={tradeCashAmount}
              disabled={Boolean(tradeAmount) || tradeSubmitting || interactionDisabled}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^0-9.]/g, "");
                const sanitized = nextValue.replace(/(\..*)\./g, "$1");
                setTradeCashAmount(sanitized);
                if (sanitized) {
                  setTradeAmount("");
                }
              }}
            />
            {tradeAmount && selected?.type === "Stock" && (
              <p className="modal-cash">
                Estimated Cash: {calculatedCashDisplay || "N/A"}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-secondary"
                onClick={() => setTradeModal({ open: false, type: null })}
                disabled={tradeSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-primary"
                disabled={disableSubmit}
                onClick={onConfirmTrade}
              >
                {tradeSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card confirmation-modal">
            <p className="modal-confirmation">{confirmation}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-primary"
                onClick={() => setConfirmation("")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
