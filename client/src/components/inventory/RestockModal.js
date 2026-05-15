import React, { useState } from "react";
import { restockAccessory } from "./inventoryApi";

export default function RestockModal({ accessory, onClose, onSaved }) {
  const [saleQty, setSaleQty] = useState("");
  const [rentQty, setRentQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sale = parseInt(saleQty) || 0;
  const rental = parseInt(rentQty) || 0;

  const newSale = (accessory.available_quantity ?? 0) + sale;
  const newRental = (accessory.rental_available_quantity ?? 0) + rental;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

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

    setSaving(true);

    try {
      if (
        (accessory.type === "for_sale" || accessory.type === "both") &&
        sale > 0
      ) {
        await restockAccessory(accessory.id, {
          quantity: sale,
          notes: notes ? `${notes} (Sale)` : "Sale restock",
          pool: "sale",
        });
      }

      if (
        (accessory.type === "for_rental" || accessory.type === "both") &&
        rental > 0
      ) {
        await restockAccessory(accessory.id, {
          quantity: rental,
          notes: notes ? `${notes} (Rental)` : "Rental restock",
          pool: "rental",
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to restock.");
    }

    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>📥 Restock: {accessory.name}</h2>
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
            {error && <div className="error-message">{error}</div>}

            <div className="summary-card">
              {(accessory.type === "for_sale" ||
                accessory.type === "both") && (
                <p>
                  <strong>Sale Available:</strong>{" "}
                  {accessory.available_quantity ?? 0}
                </p>
              )}

              {(accessory.type === "for_rental" ||
                accessory.type === "both") && (
                <p>
                  <strong>Rental Available:</strong>{" "}
                  {accessory.rental_available_quantity ?? 0}
                </p>
              )}

              {(accessory.type === "for_sale" ||
                accessory.type === "both") && (
                <p>
                  <strong>Sale Threshold:</strong>{" "}
                  {accessory.reorder_threshold ?? 5}
                </p>
              )}

              {(accessory.type === "for_rental" ||
                accessory.type === "both") && (
                <p style={{ margin: 0 }}>
                  <strong>Rental Threshold:</strong>{" "}
                  {accessory.rental_reorder_threshold ?? 5}
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
                  <label>Units to Add (Sale)</label>
                  <input
                    type="number"
                    min="1"
                    value={saleQty}
                    onChange={(e) => setSaleQty(e.target.value)}
                    autoFocus
                  />
                  {sale > 0 && (
                    <small style={{ color: "#22c55e", fontWeight: 600 }}>
                      New: {newSale}
                    </small>
                  )}
                </div>
              )}

              {(accessory.type === "for_rental" ||
                accessory.type === "both") && (
                <div className="form-group">
                  <label>Units to Add (Rental)</label>
                  <input
                    type="number"
                    min="1"
                    value={rentQty}
                    onChange={(e) => setRentQty(e.target.value)}
                  />
                  {rental > 0 && (
                    <small style={{ color: "#3b82f6", fontWeight: 600 }}>
                      New: {newRental}
                    </small>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Notes (Invoice ref, supplier, etc.)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional..."
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
              className="btn btn-success btn-sm"
              disabled={saving}
            >
              {saving ? "Restocking…" : "📥 Add to Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
