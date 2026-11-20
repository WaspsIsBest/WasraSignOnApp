import RegisterApp from "@/components/RegisterApp";

export default function Page() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="toprow">
          <div>
            <div className="brand">WASRA Key Register</div>
            <div className="event-name">Key issue and return</div>
          </div>
          <a className="secondary" href="/admin/registers">
            Registers
          </a>
        </div>
      </header>
      <RegisterApp kind="keys" />
    </div>
  );
}
