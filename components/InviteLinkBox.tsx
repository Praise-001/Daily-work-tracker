"use client";
import { useState } from "react";

interface Props {
  inviteCode: string;
  baseUrl?: string;
}

export default function InviteLinkBox({ inviteCode, baseUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const url = baseUrl
    ? `${baseUrl}/join/${inviteCode}`
    : (typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : `/join/${inviteCode}`);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

  return (
    <div className="invite-box">
      <div className="invite-box-label">Team Invite Link</div>
      <div className="invite-box-url">
        <span className="invite-box-code">{url}</span>
        <button className="invite-copy-btn" onClick={handleCopy} type="button">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        Share this link with people you want to add to your team.
      </div>
    </div>
  );
}
