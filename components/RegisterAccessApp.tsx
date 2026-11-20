"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RpcResult } from "@/lib/registers/types";
import BottomNav from "./BottomNav";

type PersonRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  club: string | null;
  job_position: string | null;
  role: string | null;
  lockers_access: string | null;
  keys_access: string | null;
  issues_access: string | null;
};

const AREAS = [
  { key: "lockers", column: "lockers_access", label: "Lockers" },
  { key: "keys", column: "keys_access", label: "Keys" },
  { key: "issues", column: "issues_access", label: "Issues" },
] as const;

const POSITIONS = ["President", "Treasurer", "Nominated contact"];

export default function RegisterAccessApp() {
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [club, setClub] = useState("");
  const [position, setPosition] = useState(POSITIONS[0]);

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

    const { data, error } = await supabase.rpc("list_register_people");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setRows((data ?? []) as PersonRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(row: PersonRow, register: string, level: string) {
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

  async function addPerson(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    if (!email.trim() || !fullName.trim()) {
      setErrorMessage("Enter the person's email and name.");
      return;
    }

    // President and Treasurer manage lockers and keys (and can report issues);
    // a nominated contact can report and update venue issues only.
    const officer = position === "President" || position === "Treasurer";
    setBusyKey("add");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("grant_register_access_by_email", {
      p_email: email.trim(),
      p_full_name: fullName.trim(),
      p_club: club.trim() || null,
      p_position: position,
      p_lockers: officer ? "edit" : "none",
      p_keys: officer ? "edit" : "none",
      p_issues: "edit",
    });
    setBusyKey("");
    const result = data as RpcResult | null;
    if (error || result?.outcome !== "saved") {
      setErrorMessage(error?.message ?? result?.message ?? "Unable to add the person.");
      return;
    }
    setMessage(`${fullName.trim()} added. You can adjust their access below.`);
    setEmail("");
    setFullName("");
    setClub("");
    setShowAdd(false);
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
        <p className="hint">
          Administrators always have full access. Everyone else needs access granted here, and needs a login.
        </p>
        {message && <div className="result success">{message}</div>}
        {errorMessage && <div className="result error">{errorMessage}</div>}

        <div className="toolbar">
          <button className="secondary" type="button" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Cancel" : "Add person"}
          </button>
        </div>

        {showAdd && (
          <form className="panel" onSubmit={addPerson}>
            <label className="field">
              <span>Login email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Full name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label className="field">
              <span>Club</span>
              <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="e.g. WASRA, WASPS" />
            </label>
            <label className="field">
              <span>Position</span>
              <select value={position} onChange={(e) => setPosition(e.target.value)}>
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <p className="muted">
              President and Treasurer get edit access to lockers, keys and issues. A nominated contact gets
              issues only.
            </p>
            <button className="primary" disabled={busyKey === "add"} type="submit">
              Save person
            </button>
          </form>
        )}

        <div className="list">
          {rows.map((row) => (
            <div key={row.user_id} style={{ padding: "13px 2px", borderBottom: "1px solid var(--line)" }}>
              <div className="row-name">{row.full_name ?? row.email ?? row.user_id}</div>
              <div className="row-meta">
                {[row.job_position, row.club, row.full_name ? row.email : null].filter(Boolean).join(" • ")}
                {row.role ? ` • sign-in role: ${row.role}` : ""}
              </div>
              {row.role === "admin" ? (
                <div className="row-meta">Administrator: full access to everything</div>
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
