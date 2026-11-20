"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRegisterAccess } from "@/lib/registers/access";

type ActivePage = "scan" | "attendance" | "events" | "import" | "registers";

const navStyle = {
  display: "grid",
  gap: "6px",
  padding: "6px",
  width: "100%",
} as const;

const linkStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
  minHeight: "38px",
  padding: "7px 4px",
  borderRadius: "10px",
  backgroundColor: "#edf3f9",
  color: "#082f49",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1.1,
  textAlign: "center",
  textDecoration: "none",
  whiteSpace: "nowrap",
} as const;

const activeLinkStyle = {
  ...linkStyle,
  backgroundColor: "#dce9f5",
  color: "#005a9c",
} as const;

export default function BottomNav({ active }: { active: ActivePage }) {
  const [canManageEvents, setCanManageEvents] = useState(false);
  const [hasRegisters, setHasRegisters] = useState(false);

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("user_profiles")
        .select("role,is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      setCanManageEvents(
        Boolean(
          data?.is_active &&
            (data.role === "admin" || data.role === "organiser"),
        ),
      );
    }

    async function loadRegisters() {
      const levels = await Promise.all([
        getRegisterAccess("lockers"),
        getRegisterAccess("keys"),
        getRegisterAccess("issues"),
      ]);
      setHasRegisters(levels.some((level) => level !== "none"));
    }

    void loadRole();
    void loadRegisters();
  }, []);

  function styleFor(page: ActivePage) {
    return active === page ? activeLinkStyle : linkStyle;
  }

  const columns = 3 + (canManageEvents ? 2 : 1) - 1 + (hasRegisters ? 1 : 0);

  return (
    <nav
      className="bottom-nav"
      style={{ ...navStyle, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      <Link href="/sign-in" style={styleFor("scan")}>
        Scan
      </Link>

      <Link href="/attendance" style={styleFor("attendance")}>
        Attendance
      </Link>

      {canManageEvents ? (
        <>
          <Link href="/admin/events" style={styleFor("events")}>
            Events
          </Link>

          <Link href="/admin/import-event" style={styleFor("import")}>
            Import
          </Link>
        </>
      ) : (
        <a href="#top" style={linkStyle}>
          Top
        </a>
      )}

      {hasRegisters && (
        <Link href="/admin/registers" style={styleFor("registers")}>
          Registers
        </Link>
      )}
    </nav>
  );
}
