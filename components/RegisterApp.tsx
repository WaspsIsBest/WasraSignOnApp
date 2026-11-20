"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRegisterAccess } from "@/lib/registers/access";
import {
  AccessLevel,
  HistoryRow,
  REGISTER_CONFIG,
  RegisterKind,
  RegisterRow,
  RpcResult,
  formatDate,
  todayLocal,
} from "@/lib/registers/types";
import BottomNav from "./BottomNav";

type Filter = "all" | "assigned" | "available" | "inactive";
type Panel = { itemId: number; mode: "assign" | "return" | "history" } | null;

export default function RegisterApp({ kind }: { kind: RegisterKind }) {
  const cfg = REGISTER_CONFIG[kind];
  const isKeys = kind === "keys";

  const [access, setAccess] = useState<AccessLevel | null>(null);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<Panel>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // add item form
  const [newNumber, setNewNumber] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // assign / return form
  const [wasra, setWasra] = useState("");
  const [holderName, setHolderName] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [deposit, setDeposit] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");

  const canEdit = access === "edit";

  const load = useCallback(async () => {
    const level = await getRegisterAccess(kind);
    setAccess(level);
    if (level === "none") return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from(cfg.registerView)
      .select("*")
      .order("item_group", { ascending: true, nullsFirst: false })
      .order("item_number", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setRows((data ?? []) as RegisterRow[]);
  }, [kind, cfg.registerView]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active);
    const assigned = active.filter((r) => r.assignment_id !== null).length;
    return { total: active.length, assigned, available: active.length - assigned };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "inactive") return !r.is_active;
        if (!r.is_active) return false;
        if (filter === "assigned") return r.assignment_id !== null;
        if (filter === "available") return r.assignment_id === null;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return [r.item_number, r.item_group, r.holder_name, r.wasra_number?.toString()]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
  }, [rows, query, filter]);

  function resetForm() {
    setWasra("");
    setHolderName("");
    setDate(todayLocal());
    setDeposit("");
    setCondition("");
    setNotes("");
  }

  function openPanel(next: Panel) {
    setMessage("");
    setErrorMessage("");
    resetForm();
    setHistory([]);
    setPanel(next);
    if (next?.mode === "history") void loadHistory(next.itemId);
  }

  async function loadHistory(itemId: number) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(cfg.historyView)
      .select("*")
      .eq("item_id", itemId)
      .order("assigned_on", { ascending: false })
      .order("assignment_id", { ascending: false });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setHistory((data ?? []) as HistoryRow[]);
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const number = newNumber.trim();
    if (!number) {
      setErrorMessage(`${cfg.numberLabel} is required.`);
      return;
    }
    if (isKeys && !newGroup.trim()) {
      setErrorMessage("Key type is required.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = isKeys
      ? await supabase.from("register_keys").insert({
          key_number: number,
          key_type: newGroup.trim(),
          description: newNotes.trim() || null,
        })
      : await supabase.from("lockers").insert({
          locker_number: number,
          location: newGroup.trim() || null,
          notes: newNotes.trim() || null,
        });
    setBusy(false);

    if (error) {
      setErrorMessage(
        error.code === "23505" ? `That ${cfg.singular} already exists.` : error.message,
      );
      return;
    }

    setMessage(`${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} ${number} added.`);
    setNewNumber("");
    setNewNotes("");
    await load();
  }

  async function setItemActive(row: RegisterRow, active: boolean) {
    setMessage("");
    setErrorMessage("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from(isKeys ? "register_keys" : "lockers")
      .update({ is_active: active })
      .eq("id", row.item_id);
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  }

  async function submitAssign(event: FormEvent, row: RegisterRow) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const wasraNumber = wasra.trim() ? Number(wasra.trim()) : null;
    if (wasraNumber !== null && (!Number.isInteger(wasraNumber) || wasraNumber <= 0)) {
      setErrorMessage("WASRA number must be a whole number.");
      return;
    }
    if (wasraNumber === null && !holderName.trim()) {
      setErrorMessage("Enter a WASRA number or a holder name.");
      return;
    }

    const depositAmount = deposit.trim() ? Number(deposit.trim()) : null;
    if (depositAmount !== null && (!Number.isFinite(depositAmount) || depositAmount < 0)) {
      setErrorMessage("Deposit must be a positive amount.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error } = isKeys
      ? await supabase.rpc("assign_key", {
          p_key_id: row.item_id,
          p_wasra_number: wasraNumber,
          p_holder_name: holderName.trim() || null,
          p_assigned_on: date || null,
          p_deposit_amount: depositAmount,
          p_condition: condition.trim() || null,
          p_notes: notes.trim() || null,
        })
      : await supabase.rpc("assign_locker", {
          p_locker_id: row.item_id,
          p_wasra_number: wasraNumber,
          p_holder_name: holderName.trim() || null,
          p_assigned_on: date || null,
          p_notes: notes.trim() || null,
        });
    setBusy(false);

    finishAction(error?.message, data as RpcResult | null, "assigned");
  }

  async function submitReturn(event: FormEvent, row: RegisterRow) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    setBusy(true);
    const supabase = createClient();
    const { data, error } = isKeys
      ? await supabase.rpc("return_key", {
          p_key_id: row.item_id,
          p_returned_on: date || null,
          p_condition: condition.trim() || null,
          p_notes: notes.trim() || null,
        })
      : await supabase.rpc("return_locker", {
          p_locker_id: row.item_id,
          p_returned_on: date || null,
          p_notes: notes.trim() || null,
        });
    setBusy(false);

    finishAction(error?.message, data as RpcResult | null, "returned");
  }

  function finishAction(rpcError: string | undefined, result: RpcResult | null, success: string) {
    if (rpcError) {
      setErrorMessage(rpcError);
      return;
    }
    if (!result || result.outcome !== success) {
      setErrorMessage(result?.message ?? "Unexpected response.");
      return;
    }
    setMessage(result.message);
    setPanel(null);
    void load();
  }

  if (access === null) {
    return (
      <main className="main">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (access === "none") {
    return (
      <>
        <main className="main">
          <div className="result error">
            <div className="result-title">NO ACCESS</div>
            <p>
              You do not have access to the {cfg.singular} register. Ask an administrator to grant it.
            </p>
          </div>
        </main>
        <BottomNav active="registers" />
      </>
    );
  }

  return (
    <>
      <main className="main">
        <div className="stats">
          <div className="stat">
            <b>{stats.total}</b>
            <span>TOTAL</span>
          </div>
          <div className="stat">
            <b>{stats.assigned}</b>
            <span>{isKeys ? "ISSUED" : "ASSIGNED"}</span>
          </div>
          <div className="stat">
            <b>{stats.available}</b>
            <span>AVAILABLE</span>
          </div>
        </div>

        {!canEdit && <p className="hint">View only. You can not change this register.</p>}
        {message && <div className="result success">{message}</div>}
        {errorMessage && <div className="result error">{errorMessage}</div>}

        <input
          className="search"
          placeholder={`Search ${cfg.plural}, holder or WASRA number`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="toolbar">
          {(["all", "assigned", "available", "inactive"] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? "primary" : "secondary"}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === "assigned" ? (isKeys ? "Issued" : "Assigned") : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          {canEdit && (
            <button className="secondary" type="button" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Cancel" : `Add ${cfg.singular}`}
            </button>
          )}
        </div>

        {canEdit && showAdd && (
          <form className="panel" onSubmit={addItem}>
            <label className="field">
              <span>{cfg.numberLabel}</span>
              <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} />
            </label>
            <label className="field">
              <span>{cfg.groupLabel}</span>
              <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            </label>
            <label className="field">
              <span>{isKeys ? "Description" : "Notes"} (optional)</span>
              <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </label>
            <button className="primary" disabled={busy} type="submit">
              Save {cfg.singular}
            </button>
          </form>
        )}

        <div className="section-head">
          <b>
            {visible.length} {visible.length === 1 ? cfg.singular : cfg.plural}
          </b>
        </div>

        <div className="list">
          {visible.length === 0 && <p className="muted">No {cfg.plural} to show.</p>}
          {visible.map((row) => {
            const assigned = row.assignment_id !== null;
            const open = panel?.itemId === row.item_id ? panel.mode : null;

            return (
              <div key={row.item_id} style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="row" style={{ borderBottom: 0 }}>
                  <div className="row-main">
                    <div className="row-name">
                      {isKeys ? `${row.item_group ?? ""} ${row.item_number}`.trim() : `Locker ${row.item_number}`}
                    </div>
                    <div className="row-meta">
                      {!isKeys && row.item_group ? `${row.item_group} • ` : ""}
                      {assigned
                        ? `${row.holder_name ?? "Unknown"}${row.wasra_number ? ` (WASRA ${row.wasra_number})` : ""} • since ${formatDate(row.assigned_on)}`
                        : row.is_active
                          ? "Available"
                          : "Inactive"}
                    </div>
                    {assigned && isKeys && (row.deposit_amount !== null || row.condition) && (
                      <div className="row-meta">
                        {row.deposit_amount !== null ? `Deposit $${Number(row.deposit_amount).toFixed(2)}` : ""}
                        {row.deposit_amount !== null && row.condition ? " • " : ""}
                        {row.condition ? `Condition: ${row.condition}` : ""}
                      </div>
                    )}
                    {row.item_notes && <div className="row-meta">{row.item_notes}</div>}
                  </div>
                  <div className="actions" style={{ marginTop: 0, alignItems: "flex-start" }}>
                    {canEdit && row.is_active && !assigned && (
                      <button
                        className="primary"
                        type="button"
                        onClick={() => openPanel(open === "assign" ? null : { itemId: row.item_id, mode: "assign" })}
                      >
                        {cfg.issueVerb}
                      </button>
                    )}
                    {canEdit && assigned && (
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => openPanel(open === "return" ? null : { itemId: row.item_id, mode: "return" })}
                      >
                        {cfg.returnVerb}
                      </button>
                    )}
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => openPanel(open === "history" ? null : { itemId: row.item_id, mode: "history" })}
                    >
                      History
                    </button>
                  </div>
                </div>

                {open === "assign" && (
                  <form className="panel" onSubmit={(e) => submitAssign(e, row)}>
                    <label className="field">
                      <span>WASRA number</span>
                      <input
                        inputMode="numeric"
                        value={wasra}
                        onChange={(e) => setWasra(e.target.value)}
                        autoFocus
                      />
                    </label>
                    <label className="field">
                      <span>Or holder name (non-member)</span>
                      <input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>{isKeys ? "Issue date" : "Assigned date"}</span>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    {isKeys && (
                      <>
                        <label className="field">
                          <span>Deposit paid ($, optional)</span>
                          <input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                        </label>
                        <label className="field">
                          <span>Condition (optional)</span>
                          <input value={condition} onChange={(e) => setCondition(e.target.value)} />
                        </label>
                      </>
                    )}
                    <label className="field">
                      <span>Notes (optional)</span>
                      <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                    <button className="primary" disabled={busy} type="submit">
                      {cfg.issueVerb} {cfg.singular}
                    </button>
                  </form>
                )}

                {open === "return" && (
                  <form className="panel" onSubmit={(e) => submitReturn(e, row)}>
                    <label className="field">
                      <span>Return date</span>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    {isKeys && (
                      <label className="field">
                        <span>Condition on return (optional)</span>
                        <input value={condition} onChange={(e) => setCondition(e.target.value)} />
                      </label>
                    )}
                    <label className="field">
                      <span>Notes (optional)</span>
                      <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                    <button className="primary" disabled={busy} type="submit">
                      Confirm return
                    </button>
                  </form>
                )}

                {open === "history" && (
                  <div className="panel">
                    {history.length === 0 && <p className="muted">No assignments recorded.</p>}
                    {history.map((h) => (
                      <div key={h.assignment_id} className="row-meta" style={{ marginBottom: 8 }}>
                        <b>{h.holder_name ?? "Unknown"}</b>
                        {h.wasra_number ? ` (WASRA ${h.wasra_number})` : ""} • {formatDate(h.assigned_on)} to{" "}
                        {h.returned_on ? formatDate(h.returned_on) : "present"}
                        {h.deposit_amount !== null ? ` • Deposit $${Number(h.deposit_amount).toFixed(2)}` : ""}
                        {h.condition ? ` • ${h.condition}` : ""}
                        {h.notes ? ` • ${h.notes}` : ""}
                      </div>
                    ))}
                    {canEdit && (
                      <div className="actions">
                        <button
                          className="danger"
                          type="button"
                          disabled={busy || assigned}
                          onClick={() => setItemActive(row, !row.is_active)}
                        >
                          {row.is_active ? `Retire ${cfg.singular}` : `Reactivate ${cfg.singular}`}
                        </button>
                      </div>
                    )}
                    {canEdit && assigned && (
                      <p className="muted">Return it before retiring.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <BottomNav active="registers" />
    </>
  );
}
