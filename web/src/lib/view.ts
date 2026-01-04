import { useSearchParams } from "react-router";

export function useViewMode() {
  const [sp, setSp] = useSearchParams();
  const mode = (sp.get("view") as "manager" | "game") || "manager";

  function setMode(next: "manager" | "game") {
    const copy = new URLSearchParams(sp);
    copy.set("view", next);
    setSp(copy, { replace: true });
  }

  return { mode, setMode };
}
