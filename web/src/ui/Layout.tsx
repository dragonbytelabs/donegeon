import { Link, Outlet, useLocation } from "react-router";
import * as s from "./styles";

export default function Layout() {
  const loc = useLocation();

  return (
    <div>
      <div className={s.nav}>
        <strong>Donegeon</strong>

        <Link className={s.navLink} to="/inbox">
          Inbox
        </Link>
        <Link className={s.navLink} to="/live">
          Live
        </Link>
        <Link className={s.navLink} to="/world">
          World
        </Link>

        <span style={{ flex: 1 }} />

        <a
          className={s.navLink}
          href="/_/admin"
          target="_blank"
          rel="noreferrer"
        >
          /_/admin
        </a>

        <span className={s.small}>{loc.pathname}</span>
      </div>

      <div className={s.page}>
        <Outlet />
      </div>
    </div>
  );
}
