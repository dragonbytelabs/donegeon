import { css } from "@linaria/core";

export const page = css`
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Helvetica,
    Arial;
  padding: 16px;
  color: #111;
`;

export const nav = css`
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
`;

export const navLink = css`
  color: #111;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 10px;
  &:hover {
    background: #f5f5f5;
  }
`;

export const card = css`
  border: 1px solid #eee;
  border-radius: 14px;
  padding: 12px;
  margin: 12px 0;
`;

export const row = css`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

export const input = css`
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 10px;
  min-width: 220px;
`;

export const button = css`
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  &:hover {
    background: #f7f7f7;
  }
`;

export const small = css`
  color: #666;
  font-size: 12px;
`;
