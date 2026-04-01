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
}) {
  return (
    <>
      {tradeModal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>{tradeModal.type === "buy" ? "Buy" : "Sell"} Amount</h3>
            {tradeModal.type === "buy" && isOverBalance && (
              <div className="modal-warning">
                Please enter an amount less than your avaliable cash!
              </div>
            )}
            {tradeModal.type === "sell" && isOverHolding && (
              <div className="modal-warning">
                Please enter an amount less than your holding amount!
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
            {tradeModal.type === "sell" && selected?.type === "Bond" && (
              <p className="modal-cash">
                Bond Value: ${Number(selected.holdingCash || 0).toLocaleString()}
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
              disabled={Boolean(tradeCashAmount)}
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
              disabled={Boolean(tradeAmount)}
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
                onClick={() => {
                  if (tradeModal.type === "sell" && isOverHolding) {
                    return;
                  }
                  setTradeModal({ open: false, type: null });
                  const verb = tradeModal.type === "sell" ? "sold" : "bought";
                  const unitLabel = selected?.type === "Bond" ? "amount" : "shares";
                  const shareText = tradeAmount ? `${tradeAmount} ${unitLabel}` : "0 shares";
                  const cashText = tradeCashAmount
                    ? `$${tradeCashAmount}`
                    : `$${calculatedCash.toFixed(2)}`;
                  setConfirmation(
                    `A ${verb} of ${shareText} and ${cashText} of ${selected?.symbol || "stock"} is confirmed`,
                  );
                  setTradeAmount("");
                  setTradeCashAmount("");
                }}
              >
                Done
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
