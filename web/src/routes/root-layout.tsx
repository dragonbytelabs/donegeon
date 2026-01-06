import { Outlet, Link, useLocation } from "react-router";

export default function RootLayout() {
  const location = useLocation();
  const isBoard = location.pathname === "/board";

  // Board view doesn't need the nav
  if (isBoard) {
    return <Outlet />;
  }

  return (
    <div>
      <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/">Inbox</Link>
        <Link to="/quests">Quests</Link>
        <Link to="/live">Live</Link>
        <Link to="/world">World</Link>
        <Link to="/projects">Projects</Link>
        <Link 
          to="/board" 
          style={{ 
            marginLeft: "auto", 
            fontWeight: 700, 
            color: "#7c3aed",
            textDecoration: "none",
            padding: "6px 12px",
            background: "rgba(124, 58, 237, 0.1)",
            borderRadius: 6,
          }}
        >
          🎮 Board View
        </Link>
      </nav>
      <div style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}
