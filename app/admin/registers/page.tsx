import RegistersHub from "@/components/RegistersHub";

export default function Page() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="toprow">
          <div>
            <div className="brand">WASRA Registers</div>
            <div className="event-name">Lockers, keys and venue issues</div>
          </div>
          <a className="secondary" href="/admin/registers">
            Registers
          </a>
        </div>
      </header>
      <RegistersHub />
    </div>
  );
}
