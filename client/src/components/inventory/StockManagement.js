import React, { useState, useEffect, useCallback } from "react";
import { getAccessories } from "./inventoryApi";
import AddEditAccessoryModal from "./AddEditAccessoryModal";
import RestockModal from "./RestockModal";
import DiscardModal from "./DiscardModal";
import { deleteAccessory } from "./inventoryApi";

// ✅ Safe number helper
const toNumber = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// ✅ NEW UI COMPONENT
function DualValue({ sale, rental, type, prefix = "", suffix = "" }) {
  const saleVal = toNumber(sale);
  const rentVal = toNumber(rental);

  const saleStyle = { color: "#22c55e", fontWeight: 500 };
  const rentStyle = { color: "#3b82f6", fontWeight: 500 };

  if (type === "for_sale") {
    return (
      <span style={saleStyle}>
        {prefix}
        {saleVal}
        {suffix}
      </span>
    );
  }

  if (type === "for_rental") {
    return (
      <span style={rentStyle}>
        {prefix}
        {rentVal}
        {suffix}
      </span>
    );
  }

  if (type === "both") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={saleStyle}>
          {prefix}
          {saleVal}
          {suffix}
        </span>

        {/* Separator */}
        <span style={{ color: "#999" }}>|</span>

        <span style={rentStyle}>
          {prefix}
          {rentVal}
          {suffix}
        </span>
      </span>
    );
  }

  return 0;
}
function StockBar({ sale, rental, threshold }) {
  const saleQty = toNumber(sale);
  const rentalQty = toNumber(rental);
  const totalQty = saleQty + rentalQty;

  const [hover, setHover] = React.useState(false);

  if (!totalQty) {
    return (
      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        No stock
      </span>
    );
  }

  const salePct = (saleQty / totalQty) * 100;
  const rentalPct = (rentalQty / totalQty) * 100;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        position: "relative",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Bar */}
      <div
        style={{
          display: "flex",
          height: 10,
          width: 80,
          borderRadius: 6,
          overflow: "hidden",
          background: "#eee",
          cursor: "pointer",
        }}
      >
        {/* Sale */}
        <div
          style={{
            width: `${salePct}%`,
            background: "#22c55e", // green
          }}
        />

        {/* Rental */}
        <div
          style={{
            width: `${rentalPct}%`,
            background: "#3b82f6", // blue
          }}
        />
      </div>

      {/* Total */}
      <span
        style={{
          fontSize: 12,
          minWidth: 40,
          color: "var(--color-text-secondary)",
        }}
      >
        {totalQty}
      </span>

      {/* Hover Tooltip */}
      {hover && (
        <div
          style={{
            position: "absolute",
            top: -28,
            left: 0,
            background: "#111",
            color: "#fff",
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 6,
            display: "flex",
            gap: 10,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ color: "#22c55e" }}>Sale: {saleQty}</span>
          <span style={{ color: "#3b82f6" }}>Rent: {rentalQty}</span>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const map = {
    for_sale: ["inv-badge-sale", "For Sale"],
    for_rental: ["inv-badge-rental", "For Rental"],
    both: ["inv-badge-both", "Both"],
  };
  const [cls, label] = map[type] || ["inv-badge-ok", type || "—"];
  return <span className={`inv-badge ${cls}`}>{label}</span>;
}

function StockStatusBadge({ available, threshold }) {
  if (available === 0)
    return <span className="inv-badge inv-badge-out">Out of Stock</span>;
  if (available <= threshold)
    return <span className="inv-badge inv-badge-low">Low Stock</span>;
  return <span className="inv-badge inv-badge-ok">In Stock</span>;
}

export default function StockManagement() {
  const [accessories, setAccessories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [stockFilter, setStockFilter] = useState("all");
  const [addEditModal, setAddEditModal] = useState({
    open: false,
    accessory: null,
  });
  const [restockModal, setRestockModal] = useState({
    open: false,
    accessory: null,
  });
  const [discardModal, setDiscardModal] = useState({
    open: false,
    accessory: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [apiError, setApiError] = useState("");

  const fetchAccessories = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await getAccessories({ include_deleted: true });
      setAccessories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setApiError(
        err.response?.data?.error ||
          err.message ||
          "Failed to load accessories.",
      );
      setAccessories([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccessories();
  }, [fetchAccessories]);

  const handleDelete = async (id) => {
    try {
      await deleteAccessory(id);
      fetchAccessories();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
    setDeleteConfirm(null);
  };

  const filtered = accessories.filter((a) => {
    const isDel = Boolean(a.is_deleted);

    // Active / Deleted filter
    if (viewMode === "active" && isDel) return false;
    if (viewMode === "deleted" && !isDel) return false;

    // Search filter
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // Type filter
    if (stockFilter === "sale") {
      return a.type === "for_sale";
    }

    if (stockFilter === "rental") {
      return a.type === "for_rental";
    }

    if (stockFilter === "both") {
      return a.type === "both";
    }

    return true;
  });

  const activeItems = accessories.filter((a) => !a.is_deleted);

  const lowStock = activeItems.filter((a) => {
    const saleAvail = toNumber(a.available_quantity);
    const rentAvail = toNumber(a.rental_available_quantity);

    const saleTh = toNumber(a.reorder_threshold ?? 5);
    const rentTh = toNumber(a.rental_reorder_threshold ?? 5);

    const saleLow = saleAvail > 0 && saleAvail <= saleTh;
    const rentLow = rentAvail > 0 && rentAvail <= rentTh;

    return saleLow || rentLow;
  }).length;

  const outOfStock = activeItems.filter((a) => {
    const saleAvail = toNumber(a.available_quantity);
    const rentAvail = toNumber(a.rental_available_quantity);

    return saleAvail === 0 && rentAvail === 0;
  }).length;

  const totalValue = activeItems.reduce((s, a) => {
    const price = toNumber(a.price);
    const qty = toNumber(a.available_quantity);
    return s + price * qty;
  }, 0);

  return (
    <>
      {apiError && (
        <div
          className="inv-alert inv-alert-danger"
          style={{ marginBottom: 20 }}
        >
          ⚠️ <strong>Error:</strong> {apiError}
        </div>
      )}

      <div className="inv-stats-grid">
        <div
          className="inv-stat-card"
          style={{ "--accent-color": "var(--color-primary)" }}
        >
          <div className="inv-stat-label">Total Items</div>
          <div className="inv-stat-value">{activeItems.length}</div>
          <div className="inv-stat-sub">Accessory types</div>
        </div>
        <div
          className="inv-stat-card"
          style={{ "--accent-color": "var(--color-success)" }}
        >
          <div className="inv-stat-label">Inventory Value</div>
          <div className="inv-stat-value">
            ₹{totalValue.toLocaleString("en-IN")}
          </div>
          <div className="inv-stat-sub">Available stock × price</div>
        </div>
        <div
          className="inv-stat-card"
          style={{ "--accent-color": "var(--color-warning)" }}
        >
          <div className="inv-stat-label">Low Stock Alerts</div>
          <div className="inv-stat-value">{lowStock}</div>
          <div className="inv-stat-sub">Below reorder threshold</div>
        </div>
        <div
          className="inv-stat-card"
          style={{ "--accent-color": "var(--color-danger)" }}
        >
          <div className="inv-stat-label">Out of Stock</div>
          <div className="inv-stat-value">{outOfStock}</div>
          <div className="inv-stat-sub">Need immediate restock</div>
        </div>
      </div>

      <div className="inv-toolbar">
        <div className="inv-toolbar-left">
          <div className="inv-toggle-group" style={{ marginRight: 16 }}>
            <button
              className={`inv-toggle-btn${viewMode === "active" ? " active" : ""}`}
              onClick={() => setViewMode("active")}
            >
              📦 Active Stock
            </button>
            <button
              className={`inv-toggle-btn${viewMode === "deleted" ? " active" : ""}`}
              onClick={() => setViewMode("deleted")}
            >
              🗑 Deleted Items
            </button>
          </div>
          <input
            style={{
              padding: "8px 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-base)",
              fontFamily: "var(--font-family)",
              fontSize: 14,
              minWidth: 220,
            }}
            placeholder="🔍 Search accessories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inv-toolbar-right">
          <button
            className="btn btn-primary"
            onClick={() => setAddEditModal({ open: true, accessory: null })}
          >
            + Add Accessory
          </button>
        </div>
      </div>

      {viewMode === "active" &&
        !loading &&
        (lowStock > 0 || outOfStock > 0) && (
          <div
            className={`inv-alert ${outOfStock > 0 ? "inv-alert-danger" : "inv-alert-warning"}`}
          >
            ⚠️{" "}
            {outOfStock > 0 ? `${outOfStock} item(s) are out of stock. ` : ""}
            {lowStock > 0
              ? `${lowStock} item(s) are below their reorder threshold.`
              : ""}{" "}
            Please restock soon.
          </div>
        )}

      {loading ? (
        <div className="inv-empty">
          <div className="inv-empty-icon">⏳</div>
          <div>Loading...</div>
        </div>
      ) : filtered.length === 0 && !apiError ? (
        <div className="inv-empty">
          <div className="inv-empty-icon">📦</div>
          <div className="inv-empty-title">No accessories found</div>
          <div className="inv-empty-sub">
            {accessories.length === 0
              ? 'Click "+ Add Accessory" to get started.'
              : "No accessories match your filter."}
          </div>
        </div>
      ) : (
        <>
          {/* ✅ LEGEND */}

          <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    padding: "12px 16px",
    background: "#fff",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  }}
>
  {/* LEFT */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    }}
  >
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        marginRight: 6,
      }}
    >
      Filter By Type
    </span>

    {/* ALL */}
    <button
      onClick={() => setStockFilter("all")}
      className={`inv-toggle-btn ${
        stockFilter === "all" ? "active" : ""
      }`}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>All</span>
      <span
        style={{
          background: "rgba(255,255,255,0.2)",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
        }}
      >
        {activeItems.length}
      </span>
    </button>

    {/* SALE */}
    <button
      onClick={() => setStockFilter("sale")}
      className={`inv-toggle-btn ${
        stockFilter === "sale" ? "active" : ""
      }`}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          background: "#22c55e",
          borderRadius: "50%",
          display: "inline-block",
        }}
      />

      <span>Sale</span>

      <span
        style={{
          background: "rgba(255,255,255,0.2)",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
        }}
      >
        {
          activeItems.filter((a) => a.type === "for_sale").length
        }
      </span>
    </button>

    {/* RENTAL */}
    <button
      onClick={() => setStockFilter("rental")}
      className={`inv-toggle-btn ${
        stockFilter === "rental" ? "active" : ""
      }`}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          background: "#3b82f6",
          borderRadius: "50%",
          display: "inline-block",
        }}
      />

      <span>Rental</span>

      <span
        style={{
          background: "rgba(255,255,255,0.2)",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
        }}
      >
        {
          activeItems.filter((a) => a.type === "for_rental").length
        }
      </span>
    </button>

    {/* BOTH */}
    <button
      onClick={() => setStockFilter("both")}
      className={`inv-toggle-btn ${
        stockFilter === "both" ? "active" : ""
      }`}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          background:
            "linear-gradient(90deg, #22c55e 50%, #3b82f6 50%)",
          borderRadius: "50%",
          display: "inline-block",
        }}
      />

      <span>Both</span>

      <span
        style={{
          background: "rgba(255,255,255,0.2)",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
        }}
      >
        {activeItems.filter((a) => a.type === "both").length}
      </span>
    </button>
  </div>

  {/* RIGHT SIDE */}
  <div
    style={{
      fontSize: 13,
      color: "var(--color-text-muted)",
      fontWeight: 500,
    }}
  >
    Showing <strong>{filtered.length}</strong> item(s)
  </div>
</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Initial Stock</th>
                  <th>Available Stock</th>
                  <th>Discarded</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acc) => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 600 }}>{acc.name}</td>
                    <td>
                      <TypeBadge type={acc.type} />
                    </td>

                    {/* ✅ Fixed pricing */}
                    <td>
                      <DualValue
                        sale={acc.price}
                        rental={acc.rent_price}
                        type={acc.type}
                        prefix="₹"
                        suffix={
                          acc.rental_pricing_type === "hourly" ? "/hr" : ""
                        }
                      />
                    </td>

                    <td>
                      <DualValue
                        sale={acc.total_purchased_quantity}
                        rental={acc.rental_total_purchased_quantity}
                        type={acc.type}
                      />
                    </td>
                    <td>
                      <StockBar
                        sale={toNumber(acc.available_quantity)}
                        rental={toNumber(acc.rental_available_quantity)}
                        threshold={toNumber(acc.reorder_threshold ?? 5)}
                      />
                    </td>
                    <td
                      style={{
                        color:
                          acc.discarded_quantity > 0
                            ? "var(--color-danger-text)"
                            : "var(--color-text-muted)",
                      }}
                    >
                      {acc.discarded_quantity}
                    </td>
                    <td style={{ color: "var(--color-text-muted)" }}>
                      <DualValue
                        sale={acc.reorder_threshold}
                        rental={acc.rental_reorder_threshold}
                        type={acc.type}
                      />
                    </td>
                    <td>
                      {(() => {
                        const saleAvail = toNumber(acc.available_quantity);
                        const rentAvail = toNumber(
                          acc.rental_available_quantity,
                        );

                        const saleTh = toNumber(acc.reorder_threshold ?? 5);
                        const rentTh = toNumber(
                          acc.rental_reorder_threshold ?? 5,
                        );

                        const getStatus = (avail, th) => {
                          if (avail === 0) return "out";
                          if (avail <= th) return "low";
                          return "ok";
                        };

                        const saleStatus = getStatus(saleAvail, saleTh);
                        const rentStatus = getStatus(rentAvail, rentTh);

                        // BOTH
                        if (saleAvail && rentAvail) {
                          if (saleStatus === "out" && rentStatus === "out") {
                            return (
                              <span className="inv-badge inv-badge-out">
                                Out of Stock
                              </span>
                            );
                          }
                          if (saleStatus === "low" || rentStatus === "low") {
                            return (
                              <span className="inv-badge inv-badge-low">
                                Low Stock
                              </span>
                            );
                          }
                          return (
                            <span className="inv-badge inv-badge-ok">
                              In Stock
                            </span>
                          );
                        }

                        // SALE ONLY
                        if (saleAvail) {
                          return (
                            <StockStatusBadge
                              available={saleAvail}
                              threshold={saleTh}
                            />
                          );
                        }

                        // RENTAL ONLY
                        if (rentAvail) {
                          return (
                            <StockStatusBadge
                              available={rentAvail}
                              threshold={rentTh}
                            />
                          );
                        }

                        return (
                          <span className="inv-badge inv-badge-out">
                            Out of Stock
                          </span>
                        );
                      })()}
                    </td>

                    <td>
                      {viewMode === "active" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              setAddEditModal({ open: true, accessory: acc })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() =>
                              setRestockModal({ open: true, accessory: acc })
                            }
                          >
                            + Stock
                          </button>
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() =>
                              setDiscardModal({ open: true, accessory: acc })
                            }
                          >
                            Discard
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteConfirm(acc)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            color: "var(--color-danger)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Archived
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Delete Accessory</h2>
              <button
                className="close-button"
                onClick={() => setDeleteConfirm(null)}
              >
                ×
              </button>
            </div>
            <p>
              Are you sure you want to completely archive{" "}
              <strong>{deleteConfirm.name}</strong> from your active stock?
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              This item will be moved to the "Deleted Items" list. Past bookings
              containing this item will remain unaffected.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(deleteConfirm.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {addEditModal.open && (
        <AddEditAccessoryModal
          accessory={addEditModal.accessory}
          accessories={accessories.filter((a) => !a.is_deleted)}
          onClose={() => setAddEditModal({ open: false, accessory: null })}
          onSaved={fetchAccessories}
        />
      )}
      {restockModal.open && (
        <RestockModal
          accessory={restockModal.accessory}
          onClose={() => setRestockModal({ open: false, accessory: null })}
          onSaved={fetchAccessories}
        />
      )}
      {discardModal.open && (
        <DiscardModal
          accessory={discardModal.accessory}
          onClose={() => setDiscardModal({ open: false, accessory: null })}
          onSaved={fetchAccessories}
        />
      )}
    </>
  );
}
