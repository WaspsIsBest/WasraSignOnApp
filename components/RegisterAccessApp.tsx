"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RpcResult } from "@/lib/registers/types";
import BottomNav from "./BottomNav";

type StaffRow = {
  user_id: string;
  email: string | null;
  role: string;
  is_active: boolean;
  lockers_access: string | null;
  keys_access: string | null;
  issues_access: string | null;
};

const AREAS = [
  { key: "lockers", column: "lockers_access", label: "Lockers" },
  { key: "keys", column: "keys_access", label: "Keys" },
  { key: "issues", column: "issues_access", label: "Issues" },
] as const;

export default function RegisterAccessApp() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const { data: profile } = await supabase.from("user_profiles").select("role,is_active").eq("user_id", user.id).maybeSingle();
    const isAdmin = Boolean(profile?.is_active && profile.role === "admin");
    setAllowed(isAdmin);
    if (!isAdmin) return;

    const { data, error } = await supabase.rpc("list_staff_register_access");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setRows((data ?? []) as StaffRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(row: StaffRow, register: string, level: string) {
    setMessage("");
    setErrorMessage("");
    setBusyKey(`${row.user_id}:${register}`);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_register_access", {
      p_user_id: row.user_id,
      p_register: register,
      p_access_level: level,
    });
    setBusyKey("");
    const result = data as RpcResult | null;
    if (error || result?.outcome !== "saved") {
      setErrorMessage(error?.message ?? result?.message ?? "Unable to update access.");
      return;
    }
    setMessage("Access updated.");
    await load();
  }

  if (allowed === null) {
    return (
      <main className="main">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="main">
        <div className="result error">
          <div className="result-title">ADMINISTRATORS ONLY</div>
          <p>Only an administrator can change register access.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="main">
        <p className="hint">Administrators always have full access. Everyone else needs access granted here.</p>
        {message && <div className="result success">{message}</div>}
        {errorMessage && <div className="result error">{errorMessage}</div>}
        <div className="list">
          {rows.map((row) => (
            <div key={row.user_id} style={{ padding: "13px 2px", borderBottom: "1px solid var(--line)" }}>
              <div className="row-name">{row.email ?? row.user_id}</div>
              <div className="row-meta">
                {row.role}
                {row.is_active ? "" : " • inactive"}
              </div>
              {row.role === "admin" ? (
                <div className="row-meta">Full access to everything</div>
              ) : (
                <div className="facts" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  {AREAS.map((area) => (
                    <label key={area.key} className="fact">
                      <small>{area.label}</small>
                      <select
                        value={row[area.column] ?? "none"}
                        disabled={busyKey === `${row.user_id}:${area.key}`}
                        onChange={(e) => change(row, area.key, e.target.value)}
                      >
                        <option value="none">No access</option>
                        <option value="view">View</option>
                        <option value="edit">Edit</option>
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      <BottomNav active="registers" />
    </>
  );
}
