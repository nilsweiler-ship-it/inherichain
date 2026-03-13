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
  Challenged = 4,
  ChallengeFailed = 5,
  Distributing = 6,
  Distributed = 7,
}

export enum DistributionPhase {
  Phase1 = 0,
  Phase2 = 1,
  Phase3 = 2,
}

export interface PlanConfig {
  requiredApprovals: bigint;
  totalVerifiers: bigint;
  verifierBond: bigint;
  challengePeriod: bigint;
  challengeStake: bigint;
  gracePeriod: bigint;
  recoveryAddress: `0x${string}`;
  phase2Delay: bigint;
  phase3Delay: bigint;
  autoRelease: boolean;
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
  approvedAt: bigint;
  challengeDeadline: bigint;
  voteRound: bigint;
  phase1Claimed: boolean;
  phase2Claimed: boolean;
  phase3Claimed: boolean;
  snapshotBalance: bigint;
  snapshotDistributedShare: bigint;
}

export interface Challenge {
  challenger: `0x${string}`;
  stake: bigint;
  claimId: bigint;
  raisedAt: bigint;
  resolved: boolean;
  successful: boolean;
}

export interface VerifierStats {
  plansVerified: bigint;
  votesCast: bigint;
  challengesReceived: bigint;
  challengesLost: bigint;
  bondsSlashed: bigint;
}

export interface PlanDetails {
  address: `0x${string}`;
  owner: `0x${string}`;
  planName: string;
  verifiers: `0x${string}`[];
  inactivityPeriod: bigint;
  lastCheckIn: bigint;
  balance: bigint;
  heirCount: bigint;
  claimCount: bigint;
  totalShareAllocated: bigint;
  isInactive: boolean;
  config: PlanConfig;
  gracePeriodActive: boolean;
  recoveryExtensionUsed: boolean;
}

export interface OracleResult {
  completed: boolean;
  validated: boolean;
}

export interface FallbackVerifier {
  verifierAddress: `0x${string}`;
  stake: bigint;
  active: boolean;
  assignedPlans: bigint;
  registeredAt: bigint;
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
  [ClaimStatus.Challenged]: "Challenged",
  [ClaimStatus.ChallengeFailed]: "Challenge Failed",
  [ClaimStatus.Distributing]: "Distributing",
  [ClaimStatus.Distributed]: "Distributed",
};
