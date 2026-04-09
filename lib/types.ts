import type { Timestamp } from "firebase/firestore";

export type UserType = "personal" | "team";
export type EntryStatus = "pending" | "approved";
export type RateType = "hour" | "day";

export interface UserProfile {
  uid: string;
  name: string;
  type: UserType;
  teamName?: string;
  adminTeamId?: string;
  joinedTeams?: string[];
  theme?: "light" | "dark";
  createdAt?: Timestamp;
}

export interface Job {
  id: string;
  name: string;
  cur: string;
  curSymbol: string;
  rateType: RateType;
  defRate?: number;
  memberRates?: Record<string, number>;
  ownerUid: string;
  teamId?: string;
  createdAt: Timestamp;
}

export interface Entry {
  id: string;
  jobId: string;
  date: string;
  hours: number;
  rate?: number;
  note?: string;
  status: EntryStatus;
  workerUid: string;
  workerName?: string;
  amount?: number;
  teamId?: string;
  createdAt: Timestamp;
}

export interface TeamMember {
  name: string;
  joinedAt: Timestamp;
}

export interface Team {
  id: string;
  name: string;
  adminUid: string;
  inviteCode: string;
  createdAt: Timestamp;
  members: Record<string, TeamMember>;
  paidPeriods?: Record<string, boolean>;
  adminEmail?: string;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  label: string;
}
