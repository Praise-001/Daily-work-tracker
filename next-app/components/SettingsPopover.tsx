"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "../lib/ThemeContext";
import { auth, signOut } from "../lib/firebase";

interface Props {
  open: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

export function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="gear-btn" onClick={onClick} title="Settings" type="button">
      <GearIcon />
    </button>
  );
}

export default function SettingsPopover({ open, onClose, onSignOut }: Props) {
  const { theme, toggleTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSignOut() {
    onClose();
    await signOut(auth);
    onSignOut?.();
  }

  return (
    <div ref={ref} className="settings-popover">
      <button className="settings-popover-item" type="button" onClick={() => { toggleTheme(); onClose(); }}>
        <span style={{ fontSize: 16 }}>{theme === "dark" ? "☀️" : "🌙"}</span>
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
        <div className={`theme-toggle-track${theme === "light" ? " on" : ""}`}>
          <div className="theme-toggle-thumb" />
        </div>
      </button>
      <button className="settings-popover-item danger" type="button" onClick={handleSignOut}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>
    </div>
  );
}
