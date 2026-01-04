import { Navigate, Route, Routes } from "react-router";
import Layout from "./ui/Layout";
import InboxPage from "./pages/InboxPage";
import LivePage from "./pages/LivePage";
import WorldPage from "./pages/WorldPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/inbox" replace />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/world" element={<WorldPage />} />
      </Route>
    </Routes>
  );
}
