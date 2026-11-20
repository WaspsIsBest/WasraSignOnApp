import IssuesApp from "@/components/IssuesApp";

export default function Page() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="toprow">
          <div>
            <div className="brand">WASRA Venue Issues</div>
            <div className="event-name">Report and track venue problems</div>
          </div>
          <a className="secondary" href="/admin/registers">
            Registers
          </a>
        </div>
      </header>
      <IssuesApp />
    </div>
  );
}
