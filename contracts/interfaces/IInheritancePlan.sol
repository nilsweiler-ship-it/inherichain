// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInheritancePlan {
    enum ConditionType {
        Death,
        Birth,
        Degree,
        Marriage,
        Age,
        Custom
    }

    enum ClaimStatus {
        None,
        Pending,
        Approved,
        Rejected,
        Challenged,
        ChallengeFailed,
        Distributing,
        Distributed
    }

    enum DistributionPhase {
        Phase1,
        Phase2,
        Phase3
    }

    struct PlanConfig {
        uint256 requiredApprovals;   // M
        uint256 totalVerifiers;      // N (must match verifiers array length)
        uint256 verifierBond;        // wei required from each verifier
        uint256 challengePeriod;     // seconds (min 1 day)
        uint256 challengeStake;      // wei required to raise challenge
        uint256 gracePeriod;         // seconds for deadman's switch grace
        address recoveryAddress;     // can extend check-in once
        uint256 phase2Delay;         // seconds before Phase 2 unlocks (default 14 days)
        uint256 phase3Delay;         // seconds before Phase 3 unlocks (default 30 days)
        bool autoRelease;            // if true, anyone can call distributePhase after delay
    }

    struct Heir {
        address wallet;
        uint256 sharePercentage; // basis points (10000 = 100%)
        ConditionType condition;
        uint256 ageThreshold;
        string conditionDetail;
    }

    struct Claim {
        address heir;
        string documentCID;
        ClaimStatus status;
        uint256 approvals;
        uint256 rejections;
        uint256 submittedAt;
        uint256 approvedAt;
        uint256 challengeDeadline;
        uint256 voteRound;
        bool phase1Claimed;
        bool phase2Claimed;
        bool phase3Claimed;
        uint256 snapshotBalance;
        uint256 snapshotDistributedShare;
    }

    struct Challenge {
        address challenger;
        uint256 stake;
        uint256 claimId;
        uint256 raisedAt;
        bool resolved;
        bool successful;
    }

    event HeirAdded(address indexed heir, uint256 sharePercentage, ConditionType condition);
    event HeirRemoved(address indexed heir);
    event HeirInvited(address indexed heir, uint256 sharePercentage);
    event HeirAccepted(address indexed heir);
    event CheckedIn(uint256 timestamp);
    event ClaimSubmitted(uint256 indexed claimId, address indexed heir, string documentCID);
    event ClaimVoted(uint256 indexed claimId, address indexed verifier, bool approved);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimRejected(uint256 indexed claimId);
    event FundsDistributed(uint256 indexed claimId, address indexed heir, uint256 amount);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event VerifierStaked(address indexed verifier, uint256 amount);
    event VerifierBondReturned(address indexed verifier, uint256 amount);
    event VerifierBondSlashed(address indexed verifier, uint256 amount);
    event ChallengeRaised(uint256 indexed challengeId, uint256 indexed claimId, address indexed challenger);
    event ChallengeResolved(uint256 indexed challengeId, bool successful);
    event ClaimCancelledByOwner(uint256 indexed claimId);
    event GracePeriodExtended(address indexed recoveryAddress);
    event DistributionPhaseUnlocked(uint256 indexed claimId, DistributionPhase phase);
    event PlanRevoked(address indexed owner);
    event HeirShareUpdated(address indexed heir, uint256 oldShare, uint256 newShare);
    event HeirConditionUpdated(address indexed heir, ConditionType condition);
    event InactivityPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event DistributionDelaysUpdated(uint256 phase2Delay, uint256 phase3Delay);
    event ChallengerAdded(address indexed challenger);
    event ChallengerRemoved(address indexed challenger);
    event BackupHeirSet(address indexed backupHeir);
    event BackupHeirActivated(address indexed originalHeir, address indexed backupHeir);
    event DistributionCancelled(uint256 indexed claimId);
    event OracleSet(address indexed oracle);
    event OracleValidationRecorded(uint256 indexed claimId, bool validated);
    event FallbackPoolSet(address indexed pool);
    event FallbackVerificationTriggered(uint256 indexed claimId, uint256 verifierCount);
    event AnonymizedDocumentSet(uint256 indexed claimId, string anonymizedCID);
}
