"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRegisterAccess } from "@/lib/registers/access";
import { AccessLevel } from "@/lib/registers/types";
import BottomNav from "./BottomNav";

type IssueRow = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  priority: "low" | "normal" | "urgent";
  status: "open" | "in_progress" | "resolved";
  photo_path: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  reported_by_email: string | null;
  reported_by_name: string | null;
  reported_by_club: string | null;
};

const CATEGORIES = ["Lighting", "Plumbing", "Electrical", "Building", "Grounds", "Range equipment", "Security", "Other"];
const STATUS_LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved" } as const;

function when(value: string) {
  const d = new Date(value);
  return d.toLocaleString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Shrink phone photos (often 4-10 MB) to a sensible upload size.
async function shrinkImage(file: File, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to process the photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Unable to process the photo."))), "image/jpeg", quality),
  );
}

export default function IssuesApp() {
  const [access, setAccess] = useState<AccessLevel | null>(null);
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "urgent">("normal");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [resolveNotes, setResolveNotes] = useState<Record<number, string>>({});

  const canEdit = access === "edit";

  const load = useCallback(async () => {
    const level = await getRegisterAccess("issues");
    setAccess(level);
    if (level === "none") return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("app_venue_issues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    const issues = (data ?? []) as IssueRow[];
    setRows(issues);

    const withPhotos = issues.filter((i) => i.photo_path);
    if (withPhotos.length) {
      const { data: signed } = await supabase.storage
        .from("venue-issue-photos")
        .createSignedUrls(withPhotos.map((i) => i.photo_path as string), 3600);
      const map: Record<number, string> = {};
      withPhotos.forEach((issue) => {
        const hit = signed?.find((s) => s.path === issue.photo_path);
        if (hit?.signedUrl) map[issue.id] = hit.signedUrl;
      });
      setPhotoUrls(map);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const visible = useMemo(
    () =>
      rows.filter((r) =>
        filter === "all" ? true : filter === "resolved" ? r.status === "resolved" : r.status !== "resolved",
      ),
    [rows, filter],
  );

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    setPhoto(event.target.files?.[0] ?? null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    if (!title.trim()) {
      setErrorMessage("Enter a short title for the issue.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      let photoPath: string | null = null;

      if (photo) {
        const blob = await shrinkImage(photo);
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("venue-issue-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        photoPath = path;
      }

      const { error } = await supabase.from("venue_issues").insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        location: location.trim() || null,
        priority,
        photo_path: photoPath,
      });
      if (error) throw error;

      setMessage("Issue reported.");
      setTitle("");
      setDescription("");
      setLocation("");
      setPriority("normal");
      setPhoto(null);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setErrorMessage(err.message ?? "Unable to report the issue.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(issue: IssueRow, status: IssueRow["status"]) {
    setMessage("");
    setErrorMessage("");
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const resolved = status === "resolved";
    const { error } = await supabase
      .from("venue_issues")
      .update({
        status,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? user?.id ?? null : null,
        resolution_notes: resolved ? resolveNotes[issue.id]?.trim() || null : null,
      })
      .eq("id", issue.id);
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
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
            <p>You do not have access to venue issues. Ask an administrator to grant it.</p>
          </div>
        </main>
        <BottomNav active="registers" />
      </>
    );
  }

  return (
    <>
      <main className="main">
        {!canEdit && <p className="hint">View only. You can not report or update issues.</p>}
        {message && <div className="result success">{message}</div>}
        {errorMessage && <div className="result error">{errorMessage}</div>}

        <div className="toolbar">
          {(["active", "resolved", "all"] as const).map((f) => (
            <button key={f} className={filter === f ? "primary" : "secondary"} type="button" onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          {canEdit && (
            <button className="secondary" type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Report issue"}
            </button>
          )}
        </div>

        {canEdit && showForm && (
          <form className="panel" onSubmit={submit}>
            <label className="field">
              <span>What is the issue?</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leaking tap in toilets" />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Where at the venue (optional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Clubhouse kitchen" />
            </label>
            <label className="field">
              <span>Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="field">
              <span>Details (optional)</span>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="field">
              <span>Photo (optional)</span>
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
            </label>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected issue" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 10 }} />
            )}
            <button className="primary" disabled={busy} type="submit">
              {busy ? "Saving…" : "Submit issue"}
            </button>
          </form>
        )}

        <div className="section-head">
          <b>
            {visible.length} {visible.length === 1 ? "issue" : "issues"}
          </b>
        </div>

        <div className="list">
          {visible.length === 0 && <p className="muted">No issues to show.</p>}
          {visible.map((issue) => (
            <div key={issue.id} style={{ padding: "13px 2px", borderBottom: "1px solid var(--line)" }}>
              <div className="row" style={{ border: 0, padding: 0 }}>
                <div className="row-main">
                  <div className="row-name">{issue.title}</div>
                  <div className="row-meta">
                    {[issue.category, issue.location].filter(Boolean).join(" • ")}
                  </div>
                  <div className="row-meta">
                    Reported {when(issue.created_at)}
                    {issue.reported_by_name || issue.reported_by_email
                      ? ` by ${issue.reported_by_name ?? issue.reported_by_email}`
                      : ""}
                    {issue.reported_by_club ? ` (${issue.reported_by_club})` : ""}
                  </div>
                </div>
                <div className={`status ${issue.status === "resolved" ? "good" : issue.priority === "urgent" ? "warn" : "wait"}`}>
                  {issue.priority === "urgent" && issue.status !== "resolved" ? "URGENT • " : ""}
                  {STATUS_LABEL[issue.status]}
                </div>
              </div>
              {issue.description && <p style={{ margin: "8px 0" }}>{issue.description}</p>}
              {photoUrls[issue.id] && (
                <a href={photoUrls[issue.id]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrls[issue.id]} alt={issue.title} style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 10 }} />
                </a>
              )}
              {issue.status === "resolved" && (
                <div className="row-meta">
                  Resolved {issue.resolved_at ? when(issue.resolved_at) : ""}
                  {issue.resolution_notes ? ` • ${issue.resolution_notes}` : ""}
                </div>
              )}
              {canEdit && issue.status !== "resolved" && (
                <div className="actions">
                  {issue.status === "open" && (
                    <button className="secondary" type="button" disabled={busy} onClick={() => setStatus(issue, "in_progress")}>
                      Mark in progress
                    </button>
                  )}
                  <input
                    className="search"
                    style={{ margin: 0, flex: 1, minWidth: 160 }}
                    placeholder="Resolution note (optional)"
                    value={resolveNotes[issue.id] ?? ""}
                    onChange={(e) => setResolveNotes((n) => ({ ...n, [issue.id]: e.target.value }))}
                  />
                  <button className="primary" type="button" disabled={busy} onClick={() => setStatus(issue, "resolved")}>
                    Mark resolved
                  </button>
                </div>
              )}
              {canEdit && issue.status === "resolved" && (
                <div className="actions">
                  <button className="secondary" type="button" disabled={busy} onClick={() => setStatus(issue, "open")}>
                    Reopen
                  </button>
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
