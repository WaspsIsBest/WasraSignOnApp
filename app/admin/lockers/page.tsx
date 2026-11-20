import RegisterApp from "@/components/RegisterApp";

export default function Page() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="toprow">
          <div>
            <div className="brand">WASRA Locker Register</div>
            <div className="event-name">Locker assignments</div>
          </div>
          <a className="secondary" href="/admin/registers">
            Registers
          </a>
        </div>
      </header>
      <RegisterApp kind="lockers" />
    </div>
  );
}
