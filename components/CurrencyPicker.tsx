"use client";
import { CURRENCIES } from "../lib/currencies";

interface Props {
  value: string;
  onChange: (code: string) => void;
  id?: string;
}

export default function CurrencyPicker({ value, onChange, id }: Props) {
  return (
    <select
      id={id}
      className="currency-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} ({c.symbol}) — {c.label}
        </option>
      ))}
    </select>
  );
}
