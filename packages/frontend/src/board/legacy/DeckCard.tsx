export type LegacyDeckCardVariant = "collect" | "firstDay";

export type LegacyDeckCardProps = {
  variant: LegacyDeckCardVariant;
  title: string;
  subtitle?: string;
  footer?: string;
  onClick?: () => void;
};

export function LegacyDeckCard(props: LegacyDeckCardProps) {
  const isClickable = !!props.onClick;
  const theme =
    props.variant === "collect"
      ? {
          bg: "bg-gradient-to-br from-emerald-500 to-emerald-700",
          border: "border-emerald-200/40",
          shadow: "shadow-emerald-900/40",
          text: "text-emerald-50"
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
        "relative h-[160px] w-[120px] select-none overflow-hidden rounded-2xl border shadow-lg",
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
        <div class="text-xl font-black tracking-tight">{props.title}</div>
        {props.subtitle ? <div class="text-xs font-semibold opacity-90">{props.subtitle}</div> : null}
        {props.footer ? <div class="mt-3 text-xs font-black">{props.footer}</div> : null}
      </div>
    </div>
  );
}

