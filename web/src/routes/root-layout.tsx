import { Outlet, Link } from "react-router";

export default function RootLayout() {
  return (
    <div>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link to="/">Inbox</Link>
        {/* later: <Link to="/live">Live</Link> */}
      </nav>
      <div style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}
