import React from "react";

export default function TradeModals({
  tradeModal,
  setTradeModal,
  selected,
  tradeAmount,
  setTradeAmount,
  tradeCashAmount,
  setTradeCashAmount,
  cashBalance,
  isOverBalance,
  isOverHolding,
  stockCashValue,
  calculatedCash,
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
          <div className="modal-card">
            <h3>{tradeModal.type === "buy" ? "Buy" : "Sell"} Amount</h3>
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
                Cash Available: ${cashBalance.toLocaleString()}
              </p>
            )}
            {tradeModal.type === "sell" && selected?.type === "Stock" && (
              <p className="modal-cash">
                Shares Owned: {selected.holdingShares || 0} · Value: $
                {stockCashValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
            <label className="modal-label" htmlFor="trade-amount">
              Share Amount
            </label>
            <input
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
                Estimated Cash: $
                {calculatedCash.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setTradeModal({ open: false, type: null })}
                disabled={tradeSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
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
          <div className="modal-card">
            <p className="modal-confirmation">{confirmation}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmation("")}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
