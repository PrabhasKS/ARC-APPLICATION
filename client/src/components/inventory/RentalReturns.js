import React, { useState, useEffect, useCallback } from "react";
import { getPendingReturns, getReturns } from "./inventoryApi";
import ReturnModal from "./ReturnModal";

export default function RentalReturns() {
  const [pending, setPending] = useState({ standalone: [], booking: [] });
  const [returns, setReturns] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returnModal, setReturnModal] = useState(null);
  const [view, setView] = useState("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await getPendingReturns();
      setPending(res.data || { standalone: [], booking: [] });
    } catch {}
    setLoadingPending(false);
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoadingReturns(true);
    try {
      const res = await getReturns({ page, limit: 15 });
      setReturns(res.data.returns || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {}
    setLoadingReturns(false);
  }, [page]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);
  useEffect(() => {
    if (view === "history") fetchReturns();
  }, [view, fetchReturns]);

  const onReturnSaved = () => {
    setReturnModal(null);
    fetchPending();
    if (view === "history") fetchReturns();
  };

  const allPending = [
    ...(pending.standalone || []).map((r) => ({
      ...r,
      source_type: "standalone",
    })),
    ...(pending.booking || []).map((r) => ({ ...r, source_type: "booking" })),
  ].sort((a, b) => new Date(a.sale_date) - new Date(b.sale_date));

  const conditionBadge = (c) => {
    const map = {
      good: "inv-badge-ok",
      damaged: "inv-badge-damaged",
      discarded: "inv-badge-out",
    };
    return <span className={`inv-badge ${map[c] || "inv-badge-ok"}`}>{c}</span>;
  };

  return (
    <>
      <div className="inv-toolbar">
        <div className="inv-toggle-group" style={{ width: 400 }}>
          <button
            className={`inv-toggle-btn${view === "pending" ? " active" : ""}`}
            onClick={() => setView("pending")}
          >
            ⏳ Pending Returns ({allPending.length})
          </button>
          <button
            className={`inv-toggle-btn${view === "history" ? " active" : ""}`}
            onClick={() => setView("history")}
          >
            📜 Return History
          </button>
        </div>
      </div>

      {view === "pending" &&
        (loadingPending ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">⏳</div>
            <div>Loading...</div>
          </div>
        ) : allPending.length === 0 ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">✅</div>
            <div className="inv-empty-title">No Pending Returns</div>
            <div className="inv-empty-sub">
              All rented items have been returned.
            </div>
          </div>
        ) : (
          <>
            <div className="inv-alert inv-alert-warning">
              ⚠️ {allPending.length} rental item(s) are pending return.
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Accessory</th>
                    <th>Rented</th>
                    <th>Returned</th>
                    <th>Pending</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allPending.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className={`inv-badge ${r.source_type === "standalone" ? "inv-badge-rental" : "inv-badge-sale"}`}
                        >
                          {r.source_type === "standalone"
                            ? "🛒 Walk-in"
                            : "🎾 Booking"}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                            marginLeft: 4,
                          }}
                        >
                          #{r.source_id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {r.customer_contact}
                        </div>
                      </td>
                      <td>
                        {new Date(r.sale_date).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.accessory_name}</td>
                      <td>{r.quantity}</td>
                      <td style={{ color: "var(--color-success-text)" }}>
                        {r.returned_qty}
                      </td>
                      <td>
                        <strong style={{ color: "var(--color-warning-text)" }}>
                          {r.pending_qty}
                        </strong>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            setReturnModal({
                              source_type: r.source_type,
                              source_id: r.source_id,
                              accessory_id: r.accessory_id,
                              accessory_name: r.accessory_name,
                              max_qty: r.pending_qty,
                              customer_name: r.customer_name,
                            })
                          }
                        >
                          ↩ Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}

      {view === "history" &&
        (loadingReturns ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">⏳</div>
            <div>Loading...</div>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Source</th>
                    <th>Accessory</th>
                    <th>Qty</th>
                    <th>Condition</th>
                    <th>Damage Charge</th>
                    <th>Returned At</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          textAlign: "center",
                          color: "var(--color-text-muted)",
                          padding: 32,
                        }}
                      >
                        No return records yet.
                      </td>
                    </tr>
                  ) : (
                    returns.map((r) => (
                      <tr key={r.id}>
                        <td style={{ color: "var(--color-text-muted)" }}>
                          #{r.id}
                        </td>
                        <td>
                          <span
                            className="inv-badge inv-badge-rental"
                            style={{ textTransform: "capitalize" }}
                          >
                            {r.source_type} #{r.source_id}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.accessory_name}</td>
                        <td>{r.quantity_returned}</td>
                        <td>{conditionBadge(r.item_condition)}</td>
                        <td
                          style={{
                            color:
                              r.damage_charge > 0
                                ? "var(--color-danger-text)"
                                : "var(--color-text-muted)",
                            fontWeight: r.damage_charge > 0 ? 700 : 400,
                          }}
                        >
                          {r.damage_charge > 0
                            ? `₹${parseFloat(r.damage_charge).toFixed(2)}`
                            : "—"}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {new Date(r.returned_at).toLocaleString("en-IN")}
                        </td>
                        <td style={{ color: "var(--color-text-muted)" }}>
                          {r.processed_by || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="inv-pagination">
                <button
                  className="inv-page-btn"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      className={`inv-page-btn${page === p ? " active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  className="inv-page-btn"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </>
        ))}

      {returnModal && (
        <ReturnModal
          returnInfo={returnModal}
          onClose={() => setReturnModal(null)}
          onSaved={onReturnSaved}
        />
      )}
    </>
  );
}
