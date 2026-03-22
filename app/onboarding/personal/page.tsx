"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/AuthContext";
import StepWizard from "../../../components/StepWizard";
import CurrencyPicker from "../../../components/CurrencyPicker";
import RateTypeToggle from "../../../components/RateTypeToggle";
import { createUserProfile, createJob } from "../../../lib/firestoreService";
import { getCurrencyByCode } from "../../../lib/currencies";
import { sanitizeText } from "../../../lib/utils";
import type { RateType } from "../../../lib/types";

interface JobDraft {
  name: string;
  cur: string;
  rateType: RateType;
  defRate: string;
}

function newJobDraft(): JobDraft {
  return { name: "", cur: "USD", rateType: "hour", defRate: "" };
}

export default function PersonalOnboarding() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [jobs, setJobs] = useState<JobDraft[]>([newJobDraft()]);
  const [currentJobIdx, setCurrentJobIdx] = useState(0);
  const [showAddAnother, setShowAddAnother] = useState(false);
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

  function updateJob(idx: number, patch: Partial<JobDraft>) {
    setJobs((prev) => prev.map((j, i) => (i === idx ? { ...j, ...patch } : j)));
  }

  function addAnotherJob() {
    if (jobs.length >= 5) return;
    setJobs((prev) => [...prev, newJobDraft()]);
    setCurrentJobIdx(jobs.length);
    setShowAddAnother(true);
  }

  function removeJob(idx: number) {
    if (jobs.length <= 1) return;
    setJobs((prev) => prev.filter((_, i) => i !== idx));
    setCurrentJobIdx(Math.max(0, idx - 1));
  }

  async function handleFinish() {
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      const name = sanitizeText(displayName, 50);
      // Write all jobs first, then user profile
      for (const j of jobs) {
        const cur = getCurrencyByCode(j.cur);
        const jobData: Parameters<typeof createJob>[0] = {
          name: sanitizeText(j.name, 60),
          cur: cur.code,
          curSymbol: cur.symbol,
          rateType: j.rateType,
          ownerUid: user.uid,
        };
        if (j.defRate) jobData.defRate = parseFloat(j.defRate);
        await createJob(jobData);
      }
      await createUserProfile(user.uid, { name, type: "personal" });
      await refreshProfile();
      router.replace("/dashboard");
    } catch (e: unknown) {
      console.error("Onboarding save error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("permission") ? "Permission denied — please check Firestore rules." : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const job = jobs[currentJobIdx] ?? jobs[0];

  const steps = [
    // Step 0 — Name
    <div key="name">
      <h2>What&apos;s your name?</h2>
      <p>This is how we&apos;ll greet you on your dashboard.</p>
      <div className="form">
        <div className="field">
          <label>Your Name</label>
          <input
            type="text"
            placeholder="e.g. Alex Doe"
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

    // Step 1 — Job details
    <div key="job">
      <h2>Add your first job</h2>
      <p>Enter the details for the job you want to track.</p>
      <div className="form">
        <div className="field">
          <label>Job Name</label>
          <input
            type="text"
            placeholder="e.g. Freelance Design"
            value={job.name}
            onChange={(e) => updateJob(currentJobIdx, { name: e.target.value })}
            maxLength={60}
          />
        </div>
        <div className="field">
          <label>Currency</label>
          <CurrencyPicker
            value={job.cur}
            onChange={(cur) => updateJob(currentJobIdx, { cur })}
          />
        </div>
        <div className="field">
          <label>Pay Rate</label>
          <RateTypeToggle
            value={job.rateType}
            onChange={(rateType) => updateJob(currentJobIdx, { rateType })}
          />
        </div>
        <div className="field">
          <label>Default Rate (optional)</label>
          <input
            type="number"
            placeholder={`Amount ${job.rateType === "hour" ? "per hour" : "per day"}`}
            value={job.defRate}
            onChange={(e) => updateJob(currentJobIdx, { defRate: e.target.value })}
            min="0"
            step="0.01"
          />
        </div>
      </div>
      <div className="wizard-actions">
        <button className="btn btn-ghost" onClick={() => goToStep(0)}>Back</button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!job.name.trim()) { setError("Job name is required."); return; }
            setError("");
            goToStep(2);
          }}
        >
          Continue
        </button>
      </div>
      {error && <div className="message message-error" style={{ marginTop: 12 }}>{error}</div>}
    </div>,

    // Step 2 — Add another job or go to dashboard
    <div key="finish">
      <h2>You&apos;re all set!</h2>
      <p>Want to add another job now, or head straight to your dashboard?</p>

      {/* Summary of added jobs */}
      {jobs.map((j, i) => (
        <div key={i} className="job-card-summary">
          <div className="job-card-summary-dot" />
          <div>
            <div className="job-card-summary-name">{j.name || "Unnamed Job"}</div>
            <div className="job-card-summary-meta">
              {j.cur} · {j.rateType === "hour" ? "Per hour" : "Per day"}
              {j.defRate ? ` · ${getCurrencyByCode(j.cur).symbol}${j.defRate}` : ""}
            </div>
          </div>
          {jobs.length > 1 && (
            <button
              type="button"
              className="job-card-summary-remove"
              onClick={() => removeJob(i)}
              title="Remove"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      ))}

      {showAddAnother && (
        <div className="form" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Job Name</label>
            <input
              type="text"
              placeholder="e.g. Part-time Teaching"
              value={jobs[jobs.length - 1].name}
              onChange={(e) => updateJob(jobs.length - 1, { name: e.target.value })}
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Currency</label>
            <CurrencyPicker
              value={jobs[jobs.length - 1].cur}
              onChange={(cur) => updateJob(jobs.length - 1, { cur })}
            />
          </div>
          <div className="field">
            <label>Pay Rate</label>
            <RateTypeToggle
              value={jobs[jobs.length - 1].rateType}
              onChange={(rateType) => updateJob(jobs.length - 1, { rateType })}
            />
          </div>
        </div>
      )}

      {error && <div className="message message-error">{error}</div>}

      <div className="wizard-actions" style={{ flexDirection: "column" }}>
        {jobs.length < 5 && (
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              if (!showAddAnother) {
                addAnotherJob();
              } else {
                const last = jobs[jobs.length - 1];
                if (!last.name.trim()) { setError("Job name is required."); return; }
                setError("");
                setShowAddAnother(false);
              }
            }}
          >
            {showAddAnother ? "Save Job" : "+ Add Another Job"}
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={handleFinish}
        >
          {saving ? "Saving…" : "Go to Dashboard"}
        </button>
      </div>
    </div>,
  ];

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return <StepWizard steps={steps} currentStep={step} transitioning={transitioning} />;
}
