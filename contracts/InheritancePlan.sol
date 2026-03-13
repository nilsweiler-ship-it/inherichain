// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IInheritancePlan.sol";
import "./VerifierRegistry.sol";

contract InheritancePlan is IInheritancePlan, ReentrancyGuard {
    address public owner;
    string public planName;
    address[] public verifiers;
    PlanConfig public config;
    VerifierRegistry public registry;

    uint256 public inactivityPeriod; // seconds
    uint256 public lastCheckIn;

    Heir[] public heirs;
    mapping(address => bool) public isHeir;
    mapping(address => uint256) public heirIndex;
    uint256 public totalShareAllocated; // basis points

    Claim[] public claims;
    // verifierVoted[claimId][voteRound][verifier] => bool
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public verifierVoted;
    uint256 public distributedShare; // tracks total basis points already distributed

    Challenge[] public challenges;
    // claimId => active challengeId (0 means none if we check challenges array)
    mapping(uint256 => uint256[]) public claimChallenges;

    // Staking
    mapping(address => uint256) public verifierBonds;
    mapping(address => bool) public isVerifier;

    // Track total active bonds for distributable balance calculation
    uint256 public totalActiveBonds;

    // Deadman's switch
    bool public gracePeriodActive;
    bool public recoveryExtensionUsed;

    // Plan revocation
    bool public revoked;

    // Heir acceptance (Phase 2)
    mapping(address => bool) public heirAccepted;

    // Pre-approved challengers (Phase 1.3)
    mapping(address => bool) public isApprovedChallenger;
    address[] public approvedChallengers;

    // Backup heir (Phase 1.4)
    address public backupHeir;

    // Oracle integration (Phase 4)
    address public oracle; // InheriChainOracle contract address
    mapping(uint256 => bool) public claimOracleValidated; // claimId => oracle validated

    // Fallback verifier pool (Phase 5)
    address public fallbackPool; // FallbackVerifierPool contract address
    mapping(uint256 => bool) public claimUsesFallback; // claimId => uses fallback verifiers
    mapping(uint256 => string) public anonymizedDocumentCID; // claimId => anonymized doc CID

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_INACTIVITY_PERIOD = 30 days;
    uint256 public constant MIN_CHALLENGE_PERIOD = 1 days;

    // Default distribution delays (used when config values are 0)
    uint256 public constant DEFAULT_PHASE2_DELAY = 14 days;
    uint256 public constant DEFAULT_PHASE3_DELAY = 30 days;

    // Progressive distribution percentages (basis points of heir's share)
    uint256 public constant PHASE1_PCT = 1000; // 10%
    uint256 public constant PHASE2_PCT = 4000; // 40%
    uint256 public constant PHASE3_PCT = 5000; // 50%

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyStakedVerifier() {
        require(isVerifier[msg.sender], "Not verifier");
        require(verifierBonds[msg.sender] >= config.verifierBond, "Not staked");
        _;
    }

    modifier onlyHeir() {
        require(isHeir[msg.sender], "Not heir");
        _;
    }

    modifier ownerActive() {
        require(!_isOwnerInactive(), "Owner inactive");
        _;
    }

    modifier ownerInactive() {
        require(_isOwnerInactive(), "Owner still active");
        _;
    }

    modifier notRevoked() {
        require(!revoked, "Plan revoked");
        _;
    }

    modifier noActiveClaims() {
        require(!_hasActiveClaim(), "Active claim exists, plan locked");
        _;
    }

    constructor(
        address _owner,
        string memory _planName,
        address[] memory _verifiers,
        uint256 _inactivityPeriod,
        PlanConfig memory _config,
        address _registry
    ) {
        require(_owner != address(0), "Invalid owner");
        require(_inactivityPeriod >= MIN_INACTIVITY_PERIOD, "Period too short");
        require(_verifiers.length >= 2, "Need at least 2 verifiers");
        require(_config.requiredApprovals > 0, "M must be > 0");
        require(_config.requiredApprovals <= _verifiers.length, "M > N");
        require(_config.totalVerifiers == _verifiers.length, "N mismatch");
        require(_config.challengePeriod >= MIN_CHALLENGE_PERIOD, "Challenge period too short");
        require(_registry != address(0), "Invalid registry");

        // Validate no duplicates, no zero addresses, owner not verifier
        for (uint256 i = 0; i < _verifiers.length; i++) {
            require(_verifiers[i] != address(0), "Invalid verifier");
            require(_verifiers[i] != _owner, "Owner cannot be verifier");
            for (uint256 j = i + 1; j < _verifiers.length; j++) {
                require(_verifiers[i] != _verifiers[j], "Duplicate verifiers");
            }
        }

        owner = _owner;
        planName = _planName;
        verifiers = _verifiers;
        inactivityPeriod = _inactivityPeriod;
        lastCheckIn = block.timestamp;
        registry = VerifierRegistry(_registry);

        // Set default delays if not provided
        if (_config.phase2Delay == 0) {
            _config.phase2Delay = DEFAULT_PHASE2_DELAY;
        }
        if (_config.phase3Delay == 0) {
            _config.phase3Delay = DEFAULT_PHASE3_DELAY;
        }

        config = _config;

        for (uint256 i = 0; i < _verifiers.length; i++) {
            isVerifier[_verifiers[i]] = true;
        }
    }

    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    // ===================== Internal Helpers =====================

    function _hasActiveClaim() internal view returns (bool) {
        for (uint256 i = 0; i < claims.length; i++) {
            ClaimStatus s = claims[i].status;
            if (s == ClaimStatus.Pending || s == ClaimStatus.Approved ||
                s == ClaimStatus.Challenged || s == ClaimStatus.Distributing) {
                return true;
            }
        }
        return false;
    }

    function _getPhase2Delay() internal view returns (uint256) {
        return config.phase2Delay;
    }

    function _getPhase3Delay() internal view returns (uint256) {
        return config.phase3Delay;
    }

    // ===================== Layer 1: Verifier Staking =====================

    function stakeAsVerifier() external payable notRevoked  {
        require(isVerifier[msg.sender], "Not verifier");
        require(msg.value == config.verifierBond, "Wrong bond amount");
        require(verifierBonds[msg.sender] == 0, "Already staked");

        verifierBonds[msg.sender] = msg.value;
        totalActiveBonds += msg.value;
        registry.recordPlanVerified(msg.sender);
        emit VerifierStaked(msg.sender, msg.value);
    }

    function withdrawVerifierBond() external nonReentrant {
        require(isVerifier[msg.sender], "Not verifier");
        uint256 bond = verifierBonds[msg.sender];
        require(bond > 0, "No bond");
        require(_allClaimsSettled(), "Claims pending");

        verifierBonds[msg.sender] = 0;
        totalActiveBonds -= bond;
        (bool success, ) = payable(msg.sender).call{value: bond}("");
        require(success, "Transfer failed");

        emit VerifierBondReturned(msg.sender, bond);
    }

    function _slashVerifier(address _verifier) internal {
        uint256 bond = verifierBonds[_verifier];
        if (bond > 0) {
            verifierBonds[_verifier] = 0;
            totalActiveBonds -= bond;
            registry.recordBondSlashed(_verifier);
            emit VerifierBondSlashed(_verifier, bond);
            // Slashed funds stay in contract (added to distributable balance)
        }
    }

    function _allClaimsSettled() internal view returns (bool) {
        for (uint256 i = 0; i < claims.length; i++) {
            ClaimStatus s = claims[i].status;
            if (s == ClaimStatus.Pending || s == ClaimStatus.Approved ||
                s == ClaimStatus.Challenged || s == ClaimStatus.Distributing) {
                return false;
            }
        }
        return true;
    }

    // ===================== Heir Management =====================

    function addHeir(
        address _wallet,
        uint256 _sharePercentage,
        ConditionType _condition,
        uint256 _ageThreshold,
        string calldata _conditionDetail
    ) external onlyOwner notRevoked noActiveClaims {
        require(_wallet != address(0), "Invalid heir address");
        require(!isHeir[_wallet], "Already an heir");
        require(_sharePercentage > 0, "Share must be > 0");
        require(totalShareAllocated + _sharePercentage <= BASIS_POINTS, "Total shares exceed 100%");
        require(_wallet != owner, "Owner cannot be heir");

        heirIndex[_wallet] = heirs.length;
        heirs.push(Heir({
            wallet: _wallet,
            sharePercentage: _sharePercentage,
            condition: _condition,
            ageThreshold: _ageThreshold,
            conditionDetail: _conditionDetail
        }));
        isHeir[_wallet] = true;
        totalShareAllocated += _sharePercentage;

        emit HeirAdded(_wallet, _sharePercentage, _condition);
        emit HeirInvited(_wallet, _sharePercentage);
    }

    function removeHeir(address _wallet) external onlyOwner notRevoked noActiveClaims {
        require(isHeir[_wallet], "Not an heir");

        uint256 index = heirIndex[_wallet];
        uint256 lastIndex = heirs.length - 1;

        totalShareAllocated -= heirs[index].sharePercentage;

        if (index != lastIndex) {
            Heir storage lastHeir = heirs[lastIndex];
            heirs[index] = lastHeir;
            heirIndex[lastHeir.wallet] = index;
        }

        heirs.pop();
        delete isHeir[_wallet];
        delete heirIndex[_wallet];
        delete heirAccepted[_wallet];

        emit HeirRemoved(_wallet);
    }

    function updateHeirShare(address _wallet, uint256 _newShare) external onlyOwner notRevoked noActiveClaims {
        require(isHeir[_wallet], "Not an heir");
        require(_newShare > 0, "Share must be > 0");

        uint256 index = heirIndex[_wallet];
        uint256 oldShare = heirs[index].sharePercentage;
        uint256 newTotal = totalShareAllocated - oldShare + _newShare;
        require(newTotal <= BASIS_POINTS, "Total shares exceed 100%");

        heirs[index].sharePercentage = _newShare;
        totalShareAllocated = newTotal;

        emit HeirShareUpdated(_wallet, oldShare, _newShare);
    }

    function updateHeirCondition(
        address _wallet,
        ConditionType _condition,
        uint256 _ageThreshold,
        string calldata _conditionDetail
    ) external onlyOwner notRevoked noActiveClaims {
        require(isHeir[_wallet], "Not an heir");

        uint256 index = heirIndex[_wallet];
        heirs[index].condition = _condition;
        heirs[index].ageThreshold = _ageThreshold;
        heirs[index].conditionDetail = _conditionDetail;

        emit HeirConditionUpdated(_wallet, _condition);
    }

    function updateInactivityPeriod(uint256 _newPeriod) external onlyOwner notRevoked noActiveClaims {
        require(_newPeriod >= MIN_INACTIVITY_PERIOD, "Period too short");
        uint256 oldPeriod = inactivityPeriod;
        inactivityPeriod = _newPeriod;
        emit InactivityPeriodUpdated(oldPeriod, _newPeriod);
    }

    // ===================== Heir Acceptance (Phase 2) =====================

    function acceptInheritance() external onlyHeir notRevoked {
        require(!heirAccepted[msg.sender], "Already accepted");
        heirAccepted[msg.sender] = true;
        emit HeirAccepted(msg.sender);
    }

    // ===================== Oracle Integration (Phase 4) =====================

    function setOracle(address _oracle) external onlyOwner notRevoked {
        require(_oracle != address(0), "Invalid oracle");
        oracle = _oracle;
        emit OracleSet(_oracle);
    }

    /**
     * @notice Record oracle validation result for a claim.
     * Callable by the oracle contract after Chainlink Functions fulfillment.
     */
    function recordOracleValidation(uint256 _claimId, bool _validated) external {
        require(msg.sender == oracle, "Not oracle");
        require(_claimId < claims.length, "Invalid claim");
        claimOracleValidated[_claimId] = _validated;
        emit OracleValidationRecorded(_claimId, _validated);
    }

    // ===================== Fallback Verifier Pool (Phase 5) =====================

    function setFallbackPool(address _pool) external onlyOwner notRevoked {
        require(_pool != address(0), "Invalid pool");
        fallbackPool = _pool;
        emit FallbackPoolSet(_pool);
    }

    /**
     * @notice Set anonymized document CID for a claim (for fallback verifiers).
     * Called by backend after generating the anonymized version.
     */
    function setAnonymizedDocument(uint256 _claimId, string calldata _anonymizedCID) external onlyOwner {
        require(_claimId < claims.length, "Invalid claim");
        anonymizedDocumentCID[_claimId] = _anonymizedCID;
        emit AnonymizedDocumentSet(_claimId, _anonymizedCID);
    }

    /**
     * @notice Trigger fallback verification when all original verifiers are slashed.
     * Callable by heir when voting deadline passed with insufficient votes.
     */
    function triggerFallbackVerification(uint256 _claimId, uint256 _count) external onlyHeir {
        require(_claimId < claims.length, "Invalid claim");
        require(fallbackPool != address(0), "No fallback pool set");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Pending || claim.status == ClaimStatus.Challenged, "Invalid claim status");

        // Verify all original verifiers are slashed
        bool allSlashed = true;
        for (uint256 i = 0; i < verifiers.length; i++) {
            if (verifierBonds[verifiers[i]] > 0) {
                allSlashed = false;
                break;
            }
        }
        require(allSlashed, "Not all verifiers slashed");

        claimUsesFallback[_claimId] = true;

        // Reset vote counts for fresh round with fallback verifiers
        claim.approvals = 0;
        claim.rejections = 0;
        claim.voteRound++;
        claim.status = ClaimStatus.Pending;

        emit FallbackVerificationTriggered(_claimId, _count);
    }

    // ===================== Distribution Delay Config (Phase 1.1) =====================

    function updateDistributionDelays(uint256 _phase2Delay, uint256 _phase3Delay) external onlyOwner notRevoked noActiveClaims {
        require(_phase2Delay > 0, "Phase 2 delay must be > 0");
        require(_phase3Delay > _phase2Delay, "Phase 3 delay must be > Phase 2 delay");
        config.phase2Delay = _phase2Delay;
        config.phase3Delay = _phase3Delay;
        emit DistributionDelaysUpdated(_phase2Delay, _phase3Delay);
    }

    // ===================== Pre-approved Challengers (Phase 1.3) =====================

    function addChallenger(address _challenger) external onlyOwner notRevoked noActiveClaims {
        require(_challenger != address(0), "Invalid challenger");
        require(!isApprovedChallenger[_challenger], "Already approved");
        isApprovedChallenger[_challenger] = true;
        approvedChallengers.push(_challenger);
        emit ChallengerAdded(_challenger);
    }

    function removeChallenger(address _challenger) external onlyOwner notRevoked noActiveClaims {
        require(isApprovedChallenger[_challenger], "Not a challenger");
        isApprovedChallenger[_challenger] = false;

        // Remove from array
        for (uint256 i = 0; i < approvedChallengers.length; i++) {
            if (approvedChallengers[i] == _challenger) {
                approvedChallengers[i] = approvedChallengers[approvedChallengers.length - 1];
                approvedChallengers.pop();
                break;
            }
        }
        emit ChallengerRemoved(_challenger);
    }

    function getApprovedChallengers() external view returns (address[] memory) {
        return approvedChallengers;
    }

    // ===================== Backup Heir (Phase 1.4) =====================

    function setBackupHeir(address _backupHeir) external onlyOwner notRevoked noActiveClaims {
        require(_backupHeir != address(0), "Invalid backup heir");
        require(_backupHeir != owner, "Owner cannot be backup heir");
        backupHeir = _backupHeir;
        emit BackupHeirSet(_backupHeir);
    }

    function activateBackupHeir(address _originalHeir) external onlyOwner notRevoked {
        require(backupHeir != address(0), "No backup heir set");
        require(isHeir[_originalHeir], "Not an heir");
        require(!isHeir[backupHeir], "Backup already an heir");

        uint256 index = heirIndex[_originalHeir];
        Heir storage heir = heirs[index];

        // Remove original heir
        delete isHeir[_originalHeir];
        delete heirAccepted[_originalHeir];

        // Replace with backup
        heir.wallet = backupHeir;
        isHeir[backupHeir] = true;
        heirIndex[backupHeir] = index;
        delete heirIndex[_originalHeir];

        emit BackupHeirActivated(_originalHeir, backupHeir);
        emit HeirAdded(backupHeir, heir.sharePercentage, heir.condition);
        emit HeirInvited(backupHeir, heir.sharePercentage);
    }

    // ===================== Plan Revocation =====================

    function revokePlan() external onlyOwner nonReentrant {
        require(!revoked, "Already revoked");

        revoked = true;

        // Cancel all pending/approved claims
        for (uint256 i = 0; i < claims.length; i++) {
            ClaimStatus s = claims[i].status;
            if (s == ClaimStatus.Pending || s == ClaimStatus.Approved ||
                s == ClaimStatus.Challenged || s == ClaimStatus.Distributing) {
                claims[i].status = ClaimStatus.Rejected;
            }
        }

        // Return remaining funds to owner (excluding active verifier bonds)
        uint256 distributable = address(this).balance - totalActiveBonds;
        if (distributable > 0) {
            (bool success, ) = payable(owner).call{value: distributable}("");
            require(success, "Transfer failed");
        }

        emit PlanRevoked(owner);
    }

    // ===================== Check-In & Deadman's Switch =====================

    function checkIn() external onlyOwner ownerActive notRevoked {
        lastCheckIn = block.timestamp;
        gracePeriodActive = false;
        emit CheckedIn(block.timestamp);
    }

    function extendCheckIn() external notRevoked {
        require(msg.sender == config.recoveryAddress, "Not recovery address");
        require(!recoveryExtensionUsed, "Already extended");
        require(config.gracePeriod > 0, "No grace period configured");

        recoveryExtensionUsed = true;
        gracePeriodActive = true;
        emit GracePeriodExtended(msg.sender);
    }

    function _isOwnerInactive() internal view returns (bool) {
        uint256 deadline = lastCheckIn + inactivityPeriod;
        if (gracePeriodActive) {
            deadline += config.gracePeriod;
        }
        return block.timestamp > deadline;
    }

    // ===================== Submit Claim =====================

    function submitClaim(string calldata _documentCID) external notRevoked onlyHeir ownerInactive {
        require(heirAccepted[msg.sender], "Heir has not accepted");

        // Prevent duplicate active claims from same heir
        for (uint256 i = 0; i < claims.length; i++) {
            if (claims[i].heir == msg.sender &&
                claims[i].status != ClaimStatus.Rejected &&
                claims[i].status != ClaimStatus.ChallengeFailed &&
                claims[i].status != ClaimStatus.Distributed) {
                revert("Active claim exists");
            }
        }
        uint256 claimId = claims.length;
        claims.push(Claim({
            heir: msg.sender,
            documentCID: _documentCID,
            status: ClaimStatus.Pending,
            approvals: 0,
            rejections: 0,
            submittedAt: block.timestamp,
            approvedAt: 0,
            challengeDeadline: 0,
            voteRound: 0,
            phase1Claimed: false,
            phase2Claimed: false,
            phase3Claimed: false,
            snapshotBalance: 0,
            snapshotDistributedShare: 0
        }));

        emit ClaimSubmitted(claimId, msg.sender, _documentCID);
    }

    // ===================== Layer 2: M-of-N Voting =====================

    function vote(uint256 _claimId, bool _approve) external notRevoked onlyStakedVerifier {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Pending, "Claim not pending");
        require(!verifierVoted[_claimId][claim.voteRound][msg.sender], "Already voted");

        verifierVoted[_claimId][claim.voteRound][msg.sender] = true;
        registry.recordVoteCast(msg.sender);

        if (_approve) {
            claim.approvals++;
            emit ClaimVoted(_claimId, msg.sender, true);

            if (claim.approvals >= config.requiredApprovals) {
                claim.status = ClaimStatus.Approved;
                claim.approvedAt = block.timestamp;
                claim.challengeDeadline = block.timestamp + config.challengePeriod;
                emit ClaimApproved(_claimId);
            }
        } else {
            claim.rejections++;
            emit ClaimVoted(_claimId, msg.sender, false);

            // Rejection threshold: N - M + 1 prevents approval
            uint256 rejectionThreshold = config.totalVerifiers - config.requiredApprovals + 1;
            if (claim.rejections >= rejectionThreshold) {
                claim.status = ClaimStatus.Rejected;
                emit ClaimRejected(_claimId);
            }
        }
    }

    // ===================== Layer 3: Challenge Period =====================

    function cancelClaimAsOwner(uint256 _claimId) external onlyOwner notRevoked {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(
            claim.status == ClaimStatus.Approved,
            "Can only cancel approved claims"
        );
        require(block.timestamp <= claim.challengeDeadline, "Challenge window closed");

        claim.status = ClaimStatus.Rejected;
        emit ClaimCancelledByOwner(_claimId);
    }

    function raiseChallenge(uint256 _claimId) external payable notRevoked {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Approved, "Claim not approved");
        require(block.timestamp <= claim.challengeDeadline, "Challenge window closed");
        require(msg.value == config.challengeStake, "Wrong challenge stake");

        // If approved challengers exist, require sender to be one
        if (approvedChallengers.length > 0) {
            require(isApprovedChallenger[msg.sender], "Not an approved challenger");
        }

        uint256 challengeId = challenges.length;
        challenges.push(Challenge({
            challenger: msg.sender,
            stake: msg.value,
            claimId: _claimId,
            raisedAt: block.timestamp,
            resolved: false,
            successful: false
        }));
        claimChallenges[_claimId].push(challengeId);

        claim.status = ClaimStatus.Challenged;

        // Record challenge against all verifiers who approved
        for (uint256 i = 0; i < verifiers.length; i++) {
            if (verifierVoted[_claimId][claim.voteRound][verifiers[i]]) {
                registry.recordChallengeReceived(verifiers[i]);
            }
        }

        emit ChallengeRaised(challengeId, _claimId, msg.sender);
    }

    function resolveChallenge(uint256 _challengeId) external {
        require(_challengeId < challenges.length, "Invalid challenge");
        Challenge storage challenge = challenges[_challengeId];
        require(!challenge.resolved, "Already resolved");

        Claim storage claim = claims[challenge.claimId];
        require(claim.status == ClaimStatus.Challenged, "Claim not challenged");

        // Reset vote counts and increment round for re-vote
        claim.approvals = 0;
        claim.rejections = 0;
        claim.voteRound++;
        claim.status = ClaimStatus.Pending;

        challenge.resolved = true;
    }

    function finalizeChallenge(uint256 _challengeId) external nonReentrant {
        require(_challengeId < challenges.length, "Invalid challenge");
        Challenge storage challenge = challenges[_challengeId];
        require(challenge.resolved, "Not resolved yet");
        require(!challenge.successful, "Already finalized");

        Claim storage claim = claims[challenge.claimId];

        if (claim.status == ClaimStatus.Rejected || claim.status == ClaimStatus.ChallengeFailed) {
            // Re-vote resulted in rejection: challenge succeeded
            challenge.successful = true;

            // Refund challenger
            (bool success, ) = payable(challenge.challenger).call{value: challenge.stake}("");
            require(success, "Refund failed");

            // Slash verifiers who approved in the original round (round before current)
            uint256 originalRound = claim.voteRound - 1;
            for (uint256 i = 0; i < verifiers.length; i++) {
                if (verifierVoted[challenge.claimId][originalRound][verifiers[i]]) {
                    _slashVerifier(verifiers[i]);
                    registry.recordChallengeLost(verifiers[i]);
                }
            }

            if (claim.status != ClaimStatus.ChallengeFailed) {
                claim.status = ClaimStatus.ChallengeFailed;
            }

            emit ChallengeResolved(_challengeId, true);
        } else if (claim.status == ClaimStatus.Approved) {
            // Re-vote resulted in re-approval: challenge failed
            challenge.successful = false;

            // Challenger loses stake (stays in contract)
            // Set new challenge deadline for the re-approved claim
            claim.challengeDeadline = block.timestamp + config.challengePeriod;

            emit ChallengeResolved(_challengeId, false);
        } else {
            revert("Claim not in finalizable state");
        }
    }

    function finalizeApproval(uint256 _claimId) external {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Approved, "Claim not approved");
        require(block.timestamp > claim.challengeDeadline, "Challenge period active");

        // Double confirmation: if oracle is set, require oracle validation
        if (oracle != address(0)) {
            require(claimOracleValidated[_claimId], "Oracle validation required");
        }

        // Snapshot distributable balance (excluding active verifier bonds)
        claim.snapshotBalance = address(this).balance - totalActiveBonds;
        claim.snapshotDistributedShare = distributedShare;
        claim.status = ClaimStatus.Distributing;
    }

    // ===================== Cancel Distribution (Phase 1.6) =====================

    function cancelDistribution(uint256 _claimId) external onlyOwner notRevoked {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Distributing, "Not distributing");
        require(!_isOwnerInactive(), "Owner is inactive");

        claim.status = ClaimStatus.Rejected;
        emit DistributionCancelled(_claimId);
    }

    // ===================== Layer 4: Progressive Distribution =====================

    function distributePhase(uint256 _claimId, DistributionPhase _phase) external nonReentrant {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Distributing || claim.status == ClaimStatus.Distributed, "Not distributing");

        // For auto-release plans, anyone can call. Otherwise only the claim heir.
        if (!config.autoRelease) {
            require(msg.sender == claim.heir, "Not claim heir");
        }

        uint256 heirShare = heirs[heirIndex[claim.heir]].sharePercentage;
        uint256 baseAmount = (claim.snapshotBalance * heirShare) / (BASIS_POINTS - claim.snapshotDistributedShare);

        if (_phase == DistributionPhase.Phase1) {
            require(!claim.phase1Claimed, "Phase 1 already claimed");
            // Available immediately after finalizeApproval
            claim.phase1Claimed = true;
            uint256 amount = (baseAmount * PHASE1_PCT) / BASIS_POINTS;
            _transferFunds(claim.heir, amount);
            emit FundsDistributed(_claimId, claim.heir, amount);
            emit DistributionPhaseUnlocked(_claimId, DistributionPhase.Phase1);
        } else if (_phase == DistributionPhase.Phase2) {
            require(claim.phase1Claimed, "Claim Phase 1 first");
            require(!claim.phase2Claimed, "Phase 2 already claimed");
            require(block.timestamp >= claim.approvedAt + _getPhase2Delay(), "Phase 2 not unlocked");
            claim.phase2Claimed = true;
            uint256 amount = (baseAmount * PHASE2_PCT) / BASIS_POINTS;
            _transferFunds(claim.heir, amount);
            emit FundsDistributed(_claimId, claim.heir, amount);
            emit DistributionPhaseUnlocked(_claimId, DistributionPhase.Phase2);
        } else if (_phase == DistributionPhase.Phase3) {
            require(claim.phase2Claimed, "Claim Phase 2 first");
            require(!claim.phase3Claimed, "Phase 3 already claimed");
            require(block.timestamp >= claim.approvedAt + _getPhase3Delay(), "Phase 3 not unlocked");
            claim.phase3Claimed = true;
            uint256 amount = (baseAmount * PHASE3_PCT) / BASIS_POINTS;
            _transferFunds(claim.heir, amount);

            // After Phase 3, mark as fully distributed and track share
            claim.status = ClaimStatus.Distributed;
            distributedShare += heirShare;

            emit FundsDistributed(_claimId, claim.heir, amount);
            emit DistributionPhaseUnlocked(_claimId, DistributionPhase.Phase3);
        }
    }

    function _transferFunds(address _to, uint256 _amount) internal {
        require(address(this).balance >= _amount, "Insufficient balance");
        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, "Transfer failed");
    }

    // ===================== Owner Withdraw =====================

    function withdrawFunds() external onlyOwner ownerActive nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(owner, balance);
    }

    // ===================== View Functions =====================

    function getHeirCount() external view returns (uint256) {
        return heirs.length;
    }

    function getAllHeirs() external view returns (Heir[] memory) {
        return heirs;
    }

    function getAllVerifiers() external view returns (address[] memory) {
        return verifiers;
    }

    function getClaimCount() external view returns (uint256) {
        return claims.length;
    }

    function getClaimInfo(uint256 _claimId) external view returns (Claim memory) {
        require(_claimId < claims.length, "Invalid claim");
        return claims[_claimId];
    }

    function getChallengeCount() external view returns (uint256) {
        return challenges.length;
    }

    function getChallengeInfo(uint256 _challengeId) external view returns (Challenge memory) {
        require(_challengeId < challenges.length, "Invalid challenge");
        return challenges[_challengeId];
    }

    function getClaimChallenges(uint256 _claimId) external view returns (uint256[] memory) {
        return claimChallenges[_claimId];
    }

    function isOwnerInactive() external view returns (bool) {
        return _isOwnerInactive();
    }

    function timeUntilInactive() external view returns (uint256) {
        uint256 deadline = lastCheckIn + inactivityPeriod;
        if (gracePeriodActive) {
            deadline += config.gracePeriod;
        }
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    function hasActiveClaim() external view returns (bool) {
        return _hasActiveClaim();
    }

    function getPlanDetails() external view returns (
        address _owner,
        string memory _planName,
        address[] memory _verifiers,
        uint256 _inactivityPeriod,
        uint256 _lastCheckIn,
        uint256 _balance,
        uint256 _heirCount,
        uint256 _claimCount,
        uint256 _totalShareAllocated,
        bool _isInactive,
        PlanConfig memory _config,
        bool _gracePeriodActive,
        bool _recoveryExtensionUsed
    ) {
        return (
            owner,
            planName,
            verifiers,
            inactivityPeriod,
            lastCheckIn,
            address(this).balance,
            heirs.length,
            claims.length,
            totalShareAllocated,
            _isOwnerInactive(),
            config,
            gracePeriodActive,
            recoveryExtensionUsed
        );
    }
}
