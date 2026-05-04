import React, { useState } from "react";
import { createAccessory, updateAccessory } from "./inventoryApi";

export default function AddEditAccessoryModal({
  accessory,
  accessories = [],
  onClose,
  onSaved,
}) {
  const isEdit = !!accessory;

  const [form, setForm] = useState({
    name: accessory?.name || "",
    price: accessory?.price !== undefined ? accessory.price : "",
    type: accessory?.type || "for_sale",
    rental_pricing_type: accessory?.rental_pricing_type || "flat",
    rent_price: accessory?.rent_price || "",

    // STOCK FIELDS
    initial_stock_sale: "",
    initial_stock_rental: "",

    reorder_threshold: accessory?.reorder_threshold ?? 5,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const showSalePrice = form.type === "for_sale" || form.type === "both";
  const showRentPrice = form.type === "for_rental" || form.type === "both";

  const isDuplicateName = () => {
    const trimmed = form.name.trim().toLowerCase();

    if (isEdit && trimmed === accessory?.name?.trim().toLowerCase()) {
      return false;
    }

    return accessories.some((a) => {
      const sameName = a.name?.trim().toLowerCase() === trimmed;
      return sameName && String(a.id) !== String(accessory?.id);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
        setError('Accessory name is required');
        return;
    }

    if (isDuplicateName()) {
        setError('Accessory with this name already exists');
        return;
    }

    setSaving(true);

    try {
        const payload = {
    name: form.name.trim(),
    price: showSalePrice ? (parseFloat(form.price) || 0) : 0,
    type: form.type,
    rental_pricing_type: form.rental_pricing_type,
    rent_price: showRentPrice ? (parseFloat(form.rent_price) || 0) : null,
    reorder_threshold: parseInt(form.reorder_threshold) || 5,
};

// ✅ ADD THIS BLOCK (MISSING IN YOUR CURRENT CODE)
if (!isEdit) {
    payload.total_purchased_quantity = 0;
    payload.available_quantity = 0;
    payload.rental_total_purchased_quantity = 0;
    payload.rental_available_quantity = 0;

    if (form.type === 'for_sale') {
        const stock = parseInt(form.initial_stock_sale) || 0;
        payload.total_purchased_quantity = stock;
        payload.available_quantity = stock;
    }

    if (form.type === 'for_rental') {
        const stock = parseInt(form.initial_stock_rental) || 0;
        payload.rental_total_purchased_quantity = stock;
        payload.rental_available_quantity = stock;
    }

    if (form.type === 'both') {
        const saleStock = parseInt(form.initial_stock_sale) || 0;
        const rentalStock = parseInt(form.initial_stock_rental) || 0;

        payload.total_purchased_quantity = saleStock;
        payload.available_quantity = saleStock;

        payload.rental_total_purchased_quantity = rentalStock;
        payload.rental_available_quantity = rentalStock;
    }
}

        // 👇 ADD THIS
        console.log("FORM SUBMITTED");
        console.log("PAYLOAD:", payload);

        if (isEdit) {
            await updateAccessory(accessory.id, payload);
        } else {
            await createAccessory(payload);
        }

        onSaved();
        onClose();
    } catch (err) {
        setError(err.response?.data?.message || err.message || 'Save failed');
    }

    setSaving(false);
};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Edit Accessory" : "Add New Accessory"}</h2>
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
          {error && <div className="error-message">{error}</div>}

          <div
            className="modal-body"
            style={{ overflowY: "auto", paddingRight: "4px", flex: 1 }}
          >
            <div className="form-group">
              <label>Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  setError("");
                }}
              />
            </div>

            <div className="form-group">
              <label>Accessory Type *</label>
              <div className="inv-toggle-group">
                {[
                  ["for_sale", "🏷 For Sale"],
                  ["for_rental", "🔄 For Rental"],
                  ["both", "✨ Both"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`inv-toggle-btn${form.type === val ? " active" : ""}`}
                    onClick={() => set("type", val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {showSalePrice && (
                <div className="form-group">
                  <label>Sale Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                  />
                </div>
              )}

              {showRentPrice && (
                <div className="form-group">
                  <label>Rent Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.rent_price}
                    onChange={(e) => set("rent_price", e.target.value)}
                  />
                </div>
              )}
            </div>

            {showRentPrice && (
              <div className="form-group">
                <label>Rental Mode</label>
                <div className="inv-toggle-group">
                  <button
                    type="button"
                    className={`inv-toggle-btn${form.rental_pricing_type === "flat" ? " active" : ""}`}
                    onClick={() => set("rental_pricing_type", "flat")}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    className={`inv-toggle-btn${form.rental_pricing_type === "hourly" ? " active" : ""}`}
                    onClick={() => set("rental_pricing_type", "hourly")}
                  >
                    Hourly
                  </button>
                </div>
              </div>
            )}

            {/* STOCK INPUT ONLY WHEN ADDING */}
            {!isEdit && (
              <>
                {form.type === "for_sale" && (
                  <div className="form-group">
                    <label>Initial Stock (Sale) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.initial_stock_sale}
                      onChange={(e) =>
                        set("initial_stock_sale", e.target.value)
                      }
                    />
                  </div>
                )}

                {form.type === "for_rental" && (
                  <div className="form-group">
                    <label>Initial Stock (Rental) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.initial_stock_rental}
                      onChange={(e) =>
                        set("initial_stock_rental", e.target.value)
                      }
                    />
                  </div>
                )}

                {form.type === "both" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div className="form-group">
                      <label>Initial Stock (Sale) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={form.initial_stock_sale}
                        onChange={(e) =>
                          set("initial_stock_sale", e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Initial Stock (Rental) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={form.initial_stock_rental}
                        onChange={(e) =>
                          set("initial_stock_rental", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label>Reorder Threshold</label>
              <input
                type="number"
                min="0"
                value={form.reorder_threshold}
                onChange={(e) => set("reorder_threshold", e.target.value)}
              />
            </div>

            {isEdit && (
              <div className="summary-card">
                <p>
                  <strong>Current Available (Sale):</strong>{" "}
                  {accessory.available_quantity ?? 0}
                </p>
                <p>
                  <strong>Current Available (Rental):</strong>{" "}
                  {accessory.rental_available_quantity ?? 0}
                </p>
              </div>
            )}
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
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Accessory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
