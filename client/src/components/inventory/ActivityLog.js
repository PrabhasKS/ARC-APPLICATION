import React, { useEffect, useState, useCallback } from "react";
import { getStockLog } from "./inventoryApi";
import "./ActivityLog.css";

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // 🔁 Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // 🔁 Fetch data (NO backend search for now)
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getStockLog({
        page,
        limit: 15,
      });

      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error("Error fetching stock logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 🔥 Mapping
  const changeTypeMap = {
    restock: { label: "RESTOCK", class: "activity-badge-restock" },
    sold: { label: "SOLD", class: "activity-badge-sold" },
    discarded: { label: "DISCARDED", class: "activity-badge-discarded" },
    returned: { label: "RETURNED", class: "activity-badge-returned" },
    rented_out: { label: "RENTED OUT", class: "activity-badge-rented_out" },
    damage_replace: { label: "REPLACED", class: "activity-badge-discarded" },
  };

  // ✅ FRONTEND SEARCH FILTER (WORKING)
  const filteredLogs = logs.filter((log) => {
    const typeLabel =
      changeTypeMap[log.change_type]?.label || log.change_type;

    const text = debouncedSearch.toLowerCase();

    return (
      log.accessory_name.toLowerCase().includes(text) ||
      typeLabel.toLowerCase().includes(text)
    );
  });

  return (
    <div className="activity-log">

      {/* Header */}
      <div className="activity-log-header">
        <h2 className="activity-log-title">📋 Inventory Stock Log</h2>

        <input
          type="text"
          placeholder="Search accessories or actions..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // reset page when searching
          }}
          className="activity-search-input"
        />
      </div>

      {/* Table */}
      <div className="activity-log-table-wrap">

        {loading ? (
          <div className="activity-empty">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="activity-empty">
            <div className="activity-empty-title">No matching results</div>
            <div className="activity-empty-sub">
              Try searching different keywords.
            </div>
          </div>
        ) : (
          <table className="activity-log-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Accessory</th>
                <th>Action Performed</th>
                <th>Qty Change</th>
                <th>Stock After</th>
                <th>Notes / Reference</th>
                <th>Performed By</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.map((log) => {
                const type = changeTypeMap[log.change_type] || {};

                return (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>

                    <td>{log.accessory_name}</td>

                    <td>
                      <span className={`activity-badge ${type.class}`}>
                        {type.label || log.change_type}
                      </span>
                    </td>

                    <td
                      className={
                        log.quantity_change < 0
                          ? "activity-qty-negative"
                          : "activity-qty-positive"
                      }
                    >
                      {log.quantity_change}
                    </td>

                    <td className="activity-stock-after">
                      {Number(log.stock_after)}
                    </td>

                    <td>
                      {log.notes
                        ? log.notes
                        : log.reference_type
                        ? `${log.reference_type} #${log.reference_id}`
                        : "-"}
                    </td>

                    <td>{log.performed_by}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredLogs.length >= 0 && (
        <div className="activity-log-pagination">

          <button
            className="activity-page-btn"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            className="activity-page-btn"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>

        </div>
      )}
    </div>
  );
}