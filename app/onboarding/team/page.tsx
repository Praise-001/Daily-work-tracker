"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/AuthContext";
import StepWizard from "../../../components/StepWizard";
import { createUserProfile, createTeam, updateUserProfile } from "../../../lib/firestoreService";
import { sanitizeText } from "../../../lib/utils";

export default function TeamOnboarding() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  function goToStep(next: number) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 150);
  }

  async function handleFinish() {
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      const name = sanitizeText(displayName, 50);
      const tName = sanitizeText(teamName, 80);
      const { teamId } = await createTeam(user.uid, tName);
      await createUserProfile(user.uid, { name, type: "team", teamName: tName });
      await updateUserProfile(user.uid, { adminTeamId: teamId });
      await refreshProfile();
      // Pass teamId via sessionStorage so the team page can use it on first load
      try { sessionStorage.setItem("rl-my-team-id", teamId); } catch { /* ignore */ }
      router.replace("/team");
    } catch {
      setError("Failed to create team. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    // Step 0 — Name
    <div key="name">
      <h2>What&apos;s your name?</h2>
      <p>Your name is visible to your team members.</p>
      <div className="form">
        <div className="field">
          <label>Your Name</label>
          <input
            type="text"
            placeholder="e.g. Jordan Smith"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            autoFocus
          />
        </div>
      </div>
      <div className="wizard-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (displayName.trim().length < 2) { setError("Name must be at least 2 characters."); return; }
            setError("");
            goToStep(1);
          }}
        >
          Continue
        </button>
      </div>
      {error && <div className="message message-error" style={{ marginTop: 12 }}>{error}</div>}
    </div>,

    // Step 1 — Team name
    <div key="team">
      <h2>Name your team</h2>
      <p>This is the name your team members will see when they join.</p>
      <div className="form">
        <div className="field">
          <label>Team Name</label>
          <input
            type="text"
            placeholder="e.g. Studio North"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </div>
      </div>
      {error && <div className="message message-error">{error}</div>}
      <div className="wizard-actions">
        <button className="btn btn-ghost" onClick={() => goToStep(0)}>Back</button>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={() => {
            if (teamName.trim().length < 2) { setError("Team name must be at least 2 characters."); return; }
            handleFinish();
          }}
        >
          {saving ? "Creating…" : "Create Team"}
        </button>
      </div>
    </div>,
  ];

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return <StepWizard steps={steps} currentStep={step} transitioning={transitioning} />;
}
