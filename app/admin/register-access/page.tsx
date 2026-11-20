import RegisterAccessApp from "@/components/RegisterAccessApp";

export default function Page() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="toprow">
          <div>
            <div className="brand">Register Access</div>
            <div className="event-name">Choose who can use each register</div>
          </div>
          <a className="secondary" href="/admin/registers">
            Registers
          </a>
        </div>
      </header>
      <RegisterAccessApp />
    </div>
  );
}
