import { css } from "@linaria/core";

const deck = css`
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78));
  box-shadow: 0 10px 24px rgba(0,0,0,0.06);
`;

const deckInner = css`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
`;

const pack = css`
  width: 74px;
  height: 96px;
  border-radius: 14px;
  position: relative;

  background:
    radial-gradient(50px 40px at 30% 25%, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%),
    linear-gradient(135deg, #7c3aed, #2563eb);

  border: 1px solid rgba(0,0,0,0.12);
  box-shadow:
    0 14px 22px rgba(0,0,0,0.18),
    inset 0 1px 0 rgba(255,255,255,0.35);

  &::before,
  &::after {
    content: "";
    position: absolute;
    inset: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.25);
    opacity: 0.8;
  }

  &::after {
    inset: 14px 16px;
    opacity: 0.55;
  }
`;

const title = css`
  font-weight: 900;
  letter-spacing: 0.2px;
`;

const hint = css`
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0,0,0,0.55);
`;

const button = css`
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.14);
  background: white;
  cursor: pointer;
  font-weight: 800;
  box-shadow: 0 10px 20px rgba(0,0,0,0.06);

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0px);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`;

export function GameDeck({
  title: deckTitle,
  hint: deckHint,
  onOpen,
  disabled,
}: {
  title: string;
  hint?: string;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={deck}>
      <div className={deckInner}>
        <div className={pack} />

        <div>
          <div className={title}>{deckTitle}</div>
          {deckHint && <div className={hint}>{deckHint}</div>}
        </div>

        <span style={{ flex: 1 }} />

        {onOpen && (
          <button className={button} onClick={onOpen} disabled={disabled}>
            Open
          </button>
        )}
      </div>
    </div>
  );
}
