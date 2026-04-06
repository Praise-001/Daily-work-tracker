"use client";
import { useEffect, useMemo, useState } from "react";
import type { Job, Entry } from "../lib/types";
import { CURRENCIES, getCurrencyByCode } from "../lib/currencies";
import { formatAmount } from "../lib/utils";

interface Props {
  jobs: Job[];
  entries: Entry[];
  hidden: boolean;
  onToggleHidden: () => void;
}

interface CurrencyGroup {
  code: string;
  symbol: string;
  label: string;
  total: number;
  hours: number;
  sessions: number;
}

const FX_CACHE_KEY = "rl-fx-rates";
const FX_CACHE_TTL = 3600000; // 1 hour

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function EarningsCard({ jobs, entries, hidden, onToggleHidden }: Props) {
  const [convertTo, setConvertTo] = useState<string>("");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(false);

  const groups: CurrencyGroup[] = useMemo(() => {
    const jobMap = new Map<string, Job>(jobs.map((j) => [j.id, j]));
    const map = new Map<string, CurrencyGroup>();

    for (const e of entries) {
      if (e.status !== "approved") continue;
      const job = jobMap.get(e.jobId);
      if (!job) continue;
      const cur = job.cur;
      const amount = e.amount ?? (e.hours * (e.rate ?? 0));
      if (!map.has(cur)) {
        const info = getCurrencyByCode(cur);
        map.set(cur, { code: cur, symbol: info.symbol, label: info.label, total: 0, hours: 0, sessions: 0 });
      }
      const g = map.get(cur)!;
      g.total += amount;
      g.hours += e.hours;
      g.sessions += 1;
    }

    return Array.from(map.values());
  }, [jobs, entries]);

  // Fetch exchange rates when a target currency is selected
  useEffect(() => {
    if (!convertTo) return;
    setRatesError(false);

    // Check session storage cache first
    try {
      const cached = sessionStorage.getItem(FX_CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached) as { ts: number; data: Record<string, number> };
        if (Date.now() - ts < FX_CACHE_TTL) {
          setRates(data);
          return;
        }
      }
    } catch { /* ignore */ }

    setRatesLoading(true);
    fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json")
      .then((r) => r.json())
      .then((json) => {
        const data = json.usd as Record<string, number>;
        setRates(data);
        try {
          sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch { /* ignore */ }
      })
      .catch(() => setRatesError(true))
      .finally(() => setRatesLoading(false));
  }, [convertTo]);

  const convertedTotal: number | null = useMemo(() => {
    if (!convertTo || !rates) return null;
    const targetRate = rates[convertTo.toLowerCase()];
    if (!targetRate) return null;
    let total = 0;
    for (const g of groups) {
      const fromRate = rates[g.code.toLowerCase()];
      if (!fromRate) return null;
      total += g.total * (targetRate / fromRate);
    }
    return total;
  }, [convertTo, rates, groups]);

  const convertedSymbol = convertTo ? getCurrencyByCode(convertTo).symbol : "";

  return (
    <div className="earnings-card">
      <div className="earnings-card-top">
        <span className="earnings-card-label">Overview</span>
        <button className="eye-btn" onClick={onToggleHidden} title={hidden ? "Show earnings" : "Hide earnings"}>
          <EyeIcon open={!hidden} />
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="earnings-no-data">Log sessions to see your earnings here.</div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.code} className="cur-group">
              <div className="cur-group-top">
                <div>
                  <span className="cur-group-symbol">{g.symbol}</span>
                  <span className={`cur-group-amount${hidden ? " earnings-hidden" : ""}`}>
                    {formatAmount(g.total)}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "rgba(232,201,122,0.4)" }}>{g.code}</span>
              </div>
              <div className={`cur-group-meta${hidden ? " earnings-hidden" : ""}`}>
                {g.sessions} session{g.sessions !== 1 ? "s" : ""} · {+g.hours.toFixed(3)} hrs
              </div>
            </div>
          ))}

          {/* Currency conversion section */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "rgba(201,168,76,0.5)", whiteSpace: "nowrap" }}>
                Convert to
              </span>
              <select
                value={convertTo}
                onChange={(e) => { setConvertTo(e.target.value); setRatesError(false); }}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(201,168,76,0.15)",
                  borderRadius: 8,
                  color: convertTo ? "rgba(232,201,122,0.9)" : "rgba(201,168,76,0.4)",
                  fontSize: 12,
                  padding: "5px 8px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="">Pick a currency…</option>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.label}
                  </option>
                ))}
              </select>
              {convertTo && (
                <button
                  type="button"
                  onClick={() => { setConvertTo(""); setRatesError(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(201,168,76,0.4)", padding: 2, lineHeight: 1 }}
                  title="Clear"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            {convertTo && (
              <div style={{ marginTop: 10 }}>
                {ratesLoading && (
                  <div style={{ fontSize: 12, color: "rgba(201,168,76,0.4)" }}>Fetching rates…</div>
                )}
                {ratesError && !ratesLoading && (
                  <div style={{ fontSize: 12, color: "rgba(220,80,80,0.7)" }}>Rate unavailable. Check your connection.</div>
                )}
                {!ratesLoading && !ratesError && convertedTotal !== null && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "rgba(201,168,76,0.4)", marginBottom: 4 }}>
                      ≈ total in {convertTo}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span className={`cur-group-amount${hidden ? " earnings-hidden" : ""}`} style={{ fontSize: 26 }}>
                        {convertedSymbol}{formatAmount(convertedTotal)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(201,168,76,0.3)", marginTop: 4 }}>
                      Live rates · approximate only
                    </div>
                  </div>
                )}
                {!ratesLoading && !ratesError && rates && convertedTotal === null && (
                  <div style={{ fontSize: 12, color: "rgba(201,168,76,0.4)" }}>
                    Conversion unavailable for one or more of your currencies.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
