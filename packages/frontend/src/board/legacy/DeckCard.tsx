export type LegacyDeckCardVariant = "collect" | "firstDay" | "sell";

export type LegacyDeckCardProps = {
  variant: LegacyDeckCardVariant;
  title: string;
  subtitle?: string;
  footer?: string;
  onClick?: () => void;
  size?: "default" | "dock";
};

export function LegacyDeckCard(props: LegacyDeckCardProps) {
  const isClickable = !!props.onClick;
  const size = props.size ?? "default";
  const theme =
    props.variant === "collect"
      ? {
          bg: "bg-gradient-to-br from-emerald-500 to-emerald-700",
          border: "border-emerald-200/40",
          shadow: "shadow-emerald-900/40",
          text: "text-emerald-50"
        }
      : props.variant === "sell"
        ? {
            bg: "bg-gradient-to-br from-slate-700 to-slate-900",
            border: "border-slate-200/20",
            shadow: "shadow-black/50",
            text: "text-slate-50"
          }
      : {
          bg: "bg-gradient-to-br from-indigo-500 to-violet-700",
          border: "border-indigo-200/40",
          shadow: "shadow-indigo-900/40",
          text: "text-indigo-50"
        };

  return (
    <div
      class={[
        size === "dock" ? "relative h-[116px] w-[88px] select-none overflow-hidden rounded-2xl border shadow-lg" : "relative h-[160px] w-[120px] select-none overflow-hidden rounded-2xl border shadow-lg",
        theme.bg,
        theme.border,
        theme.shadow,
        theme.text,
        isClickable ? "cursor-pointer hover:brightness-110 active:brightness-95" : "cursor-default"
      ].join(" ")}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={() => props.onClick?.()}
      onKeyDown={(e) => {
        if (!props.onClick) return;
        if (e.key === "Enter" || e.key === " ") props.onClick();
      }}
    >
      <div class="absolute inset-0 opacity-20" style={{ "background-image": "radial-gradient(circle at 30% 20%, white 0%, transparent 55%)" }} />

      <div class="relative flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <div class={size === "dock" ? "text-[13px] font-black tracking-tight" : "text-xl font-black tracking-tight"}>{props.title}</div>
        {props.subtitle ? <div class={size === "dock" ? "text-[10px] font-semibold opacity-90" : "text-xs font-semibold opacity-90"}>{props.subtitle}</div> : null}
        {props.footer ? <div class={size === "dock" ? "mt-2 text-[10px] font-black" : "mt-3 text-xs font-black"}>{props.footer}</div> : null}
      </div>
    </div>
  );
}

