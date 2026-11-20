"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRegisterAccess } from "@/lib/registers/access";
import { AccessArea, AccessLevel } from "@/lib/registers/types";
import BottomNav from "./BottomNav";

const AREAS: Array<{ area: AccessArea; label: string; href: string; blurb: string }> = [
  { area: "lockers", label: "Locker register", href: "/admin/lockers", blurb: "Who holds which locker" },
  { area: "keys", label: "Key register", href: "/admin/keys", blurb: "Keys issued and returned" },
  { area: "issues", label: "Venue issues", href: "/admin/issues", blurb: "Report faults with a photo" },
];

export default function RegistersHub() {
  const [levels, setLevels] = useState<Record<string, AccessLevel> | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const [lockers, keys, issues] = await Promise.all(AREAS.map((a) => getRegisterAccess(a.area)));
      setLevels({ lockers, keys, issues });

      const { data } = await supabase.from("user_profiles").select("role,is_active").eq("user_id", user.id).maybeSingle();
      setIsAdmin(Boolean(data?.is_active && data.role === "admin"));
    }
    void load();
  }, []);

  if (!levels) {
    return (
      <main className="main">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const available = AREAS.filter((a) => levels[a.area] !== "none");

  return (
    <>
      <main className="main">
        {available.length === 0 && (
          <div className="result info">
            <div className="result-title">NO ACCESS YET</div>
            <p>An administrator has not given you access to any register.</p>
          </div>
        )}
        <div className="list">
          {available.map((a) => (
            <Link key={a.area} href={a.href} className="row" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="row-main">
                <div className="row-name">{a.label}</div>
                <div className="row-meta">{a.blurb}</div>
              </div>
              <div className="status wait">{levels[a.area] === "edit" ? "Can edit" : "View only"}</div>
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin/register-access" className="row" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="row-main">
                <div className="row-name">Manage access</div>
                <div className="row-meta">Choose who can view or edit each area</div>
              </div>
            </Link>
          )}
        </div>
      </main>
      <BottomNav active="registers" />
    </>
  );
}
