"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/AuthContext";
import StepWizard from "../../../components/StepWizard";
import CurrencyPicker from "../../../components/CurrencyPicker";
import RateTypeToggle from "../../../components/RateTypeToggle";
import { createUserProfile, createTeam, updateUserProfile, createJob } from "../../../lib/firestoreService";
import { getCurrencyByCode } from "../../../lib/currencies";
import { sanitizeText } from "../../../lib/utils";
import type { RateType } from "../../../lib/types";

export default function TeamOnboarding() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");

  // First job fields
  const [jobName, setJobName] = useState("");
  const [jobCur, setJobCur] = useState("USD");
  const [jobRateType, setJobRateType] = useState<RateType>("hour");
  const [jobDefRate, setJobDefRate] = useState("");

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

  async function handleFinish(skipJob = false) {
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      const name = sanitizeText(displayName, 50);
      const tName = sanitizeText(teamName, 80);
      const { teamId } = await createTeam(user.uid, tName, user.email ?? undefined);
      await createUserProfile(user.uid, { name, type: "team", teamName: tName });
      await updateUserProfile(user.uid, { adminTeamId: teamId });
      // Create first job if provided
      if (!skipJob && jobName.trim().length >= 2) {
        const currency = getCurrencyByCode(jobCur);
        const jobData: Parameters<typeof createJob>[0] = {
          name: sanitizeText(jobName, 60),
          cur: currency.code,
          curSymbol: currency.symbol,
          rateType: jobRateType,
          ownerUid: user.uid,
          teamId,
        };
        if (jobDefRate) jobData.defRate = parseFloat(jobDefRate);
        await createJob(jobData);
      }

      await refreshProfile();
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
          onClick={() => {
            if (teamName.trim().length < 2) { setError("Team name must be at least 2 characters."); return; }
            setError("");
            goToStep(2);
          }}
        >
          Continue
        </button>
      </div>
    </div>,

    // Step 2 — First job (optional)
    <div key="job">
      <h2>Add your first job</h2>
      <p>Create a job your team members can log sessions against. You can skip this and add jobs later.</p>
      <div className="form">
        <div className="field">
          <label>Job Name</label>
          <input
            type="text"
            placeholder="e.g. Video Editing"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            maxLength={60}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Currency</label>
          <CurrencyPicker value={jobCur} onChange={setJobCur} />
        </div>
        <div className="field">
          <label>Rate Type</label>
          <RateTypeToggle value={jobRateType} onChange={setJobRateType} />
        </div>
        <div className="field">
          <label>Default Pay Amount <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span></label>
          <input
            type="number"
            placeholder={`Amount per ${jobRateType}`}
            value={jobDefRate}
            onChange={(e) => setJobDefRate(e.target.value)}
            min="0"
            step="0.01"
          />
          <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
            Used to estimate earnings for you and your team members.
          </span>
        </div>
      </div>
      {error && <div className="message message-error">{error}</div>}
      <div className="wizard-actions">
        <button className="btn btn-ghost" onClick={() => goToStep(1)}>Back</button>
        <button className="btn btn-ghost" disabled={saving} onClick={() => handleFinish(true)}>
          Skip
        </button>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={() => {
            if (jobName.trim().length < 2) { setError("Job name must be at least 2 characters."); return; }
            setError("");
            handleFinish(false);
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
