import React, { useState } from "react";
import { discardAccessory } from "./inventoryApi";

export default function DiscardModal({ accessory, onClose, onSaved }) {
  const [saleQty, setSaleQty] = useState("");
  const [rentQty, setRentQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sale = parseInt(saleQty) || 0;
  const rental = parseInt(rentQty) || 0;

  const saleAvailable = accessory.available_quantity ?? 0;
  const rentalAvailable = accessory.rental_available_quantity ?? 0;

  const newSale = saleAvailable - sale;
  const newRental = rentalAvailable - rental;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError("Please provide a reason for discarding.");
      return;
    }

    if (accessory.type === "for_sale" && sale <= 0) {
      setError("Enter valid sale quantity.");
      return;
    }

    if (accessory.type === "for_rental" && rental <= 0) {
      setError("Enter valid rental quantity.");
      return;
    }

    if (accessory.type === "both" && sale <= 0 && rental <= 0) {
      setError("Enter at least one quantity.");
      return;
    }

    if (sale > saleAvailable) {
      setError(`Only ${saleAvailable} sale unit(s) available.`);
      return;
    }

    if (rental > rentalAvailable) {
      setError(`Only ${rentalAvailable} rental unit(s) available.`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (
        (accessory.type === "for_sale" || accessory.type === "both") &&
        sale > 0
      ) {
        await discardAccessory(accessory.id, {
          quantity: sale,
          reason: reason,
          pool: "sale",
        });
      }

      if (
        (accessory.type === "for_rental" || accessory.type === "both") &&
        rental > 0
      ) {
        await discardAccessory(accessory.id, {
          quantity: rental,
          reason: reason,
          pool: "rental",
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to discard.");
    }

    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>🗑 Discard Stock: {accessory.name}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            maxHeight: "75vh",
          }}
        >
          <div
            className="modal-body"
            style={{
              overflowY: "auto",
              paddingRight: "4px",
              flex: 1,
            }}
          >
            <div className="message error" style={{ marginBottom: 12 }}>
              ⚠️ Discarded items are permanently removed from available stock.
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="summary-card">
              {(accessory.type === "for_sale" ||
                accessory.type === "both") && (
                <p>
                  <strong>Sale Available:</strong> {saleAvailable}
                </p>
              )}

              {(accessory.type === "for_rental" ||
                accessory.type === "both") && (
                <p>
                  <strong>Rental Available:</strong> {rentalAvailable}
                </p>
              )}

              {(accessory.type === "for_sale" ||
                accessory.type === "both") && (
                <p>
                  <strong>Sale Discarded:</strong>{" "}
                  {accessory.discarded_quantity ?? 0}
                </p>
              )}

              {(accessory.type === "for_rental" ||
                accessory.type === "both") && (
                <p style={{ margin: 0 }}>
                  <strong>Rental Discarded:</strong>{" "}
                  {accessory.rental_discarded_quantity ?? 0}
                </p>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  accessory.type === "both" ? "1fr 1fr" : "1fr",
                gap: 12,
              }}
            >
              {(accessory.type === "for_sale" ||
                accessory.type === "both") && (
                <div className="form-group">
                  <label>Units to Discard (Sale)</label>
                  <input
                    type="number"
                    min="1"
                    max={saleAvailable}
                    value={saleQty}
                    onChange={(e) => setSaleQty(e.target.value)}
                    autoFocus
                  />
                  {sale > 0 && (
                    <small
                      style={{
                        color:
                          newSale < 0
                            ? "var(--color-danger-text)"
                            : "var(--color-warning-text)",
                        fontWeight: 600,
                      }}
                    >
                      {newSale < 0
                        ? `⚠️ Cannot exceed (${saleAvailable})`
                        : `Stock after: ${newSale}`}
                    </small>
                  )}
                </div>
              )}

              {(accessory.type === "for_rental" ||
                accessory.type === "both") && (
                <div className="form-group">
                  <label>Units to Discard (Rental)</label>
                  <input
                    type="number"
                    min="1"
                    max={rentalAvailable}
                    value={rentQty}
                    onChange={(e) => setRentQty(e.target.value)}
                  />
                  {rental > 0 && (
                    <small
                      style={{
                        color:
                          newRental < 0
                            ? "var(--color-danger-text)"
                            : "var(--color-warning-text)",
                        fontWeight: 600,
                      }}
                    >
                      {newRental < 0
                        ? `⚠️ Cannot exceed (${rentalAvailable})`
                        : `Stock after: ${newRental}`}
                    </small>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Reason for Discarding *</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. damaged, worn out..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-danger btn-sm"
              disabled={saving || newSale < 0 || newRental < 0}
            >
              {saving ? "Discarding…" : "🗑 Confirm Discard"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}