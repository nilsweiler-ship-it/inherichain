export enum ConditionType {
  Death = 0,
  Birth = 1,
  Degree = 2,
  Marriage = 3,
  Age = 4,
  Custom = 5,
}

export enum ClaimStatus {
  None = 0,
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Distributed = 4,
}

export interface Heir {
  wallet: `0x${string}`;
  sharePercentage: bigint;
  condition: ConditionType;
  ageThreshold: bigint;
  conditionDetail: string;
}

export interface Claim {
  heir: `0x${string}`;
  documentCID: string;
  status: ClaimStatus;
  approvals: bigint;
  rejections: bigint;
  submittedAt: bigint;
  heirShare: bigint;
}

export interface PlanDetails {
  address: `0x${string}`;
  owner: `0x${string}`;
  planName: string;
  verifiers: [`0x${string}`, `0x${string}`, `0x${string}`];
  inactivityPeriod: bigint;
  lastCheckIn: bigint;
  balance: bigint;
  heirCount: bigint;
  claimCount: bigint;
  totalShareAllocated: bigint;
  isInactive: boolean;
}

export interface HeirFormData {
  wallet: string;
  sharePercentage: number;
  condition: ConditionType;
  ageThreshold: number;
  conditionDetail: string;
}

export const CONDITION_LABELS: Record<ConditionType, string> = {
  [ConditionType.Death]: "Death Certificate",
  [ConditionType.Birth]: "Birth Certificate",
  [ConditionType.Degree]: "Degree Certificate",
  [ConditionType.Marriage]: "Marriage Certificate",
  [ConditionType.Age]: "Age Verification",
  [ConditionType.Custom]: "Custom Condition",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  [ClaimStatus.None]: "None",
  [ClaimStatus.Pending]: "Pending",
  [ClaimStatus.Approved]: "Approved",
  [ClaimStatus.Rejected]: "Rejected",
  [ClaimStatus.Distributed]: "Distributed",
};
