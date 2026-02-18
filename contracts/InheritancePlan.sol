// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IInheritancePlan.sol";

contract InheritancePlan is IInheritancePlan, ReentrancyGuard {
    address public owner;
    address[3] public verifiers;
    uint256 public inactivityPeriod; // in seconds
    uint256 public lastCheckIn;
    string public planName;

    Heir[] public heirs;
    mapping(address => bool) public isHeir;
    mapping(address => uint256) public heirIndex;
    uint256 public totalShareAllocated; // in basis points

    Claim[] public claims;
    mapping(uint256 => mapping(address => bool)) public verifierVoted;
    uint256 public distributedShare; // tracks total basis points already distributed

    uint256 public constant REQUIRED_APPROVALS = 2;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_INACTIVITY_PERIOD = 30 days;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVerifier() {
        require(
            msg.sender == verifiers[0] ||
            msg.sender == verifiers[1] ||
            msg.sender == verifiers[2],
            "Not verifier"
        );
        _;
    }

    modifier onlyHeir() {
        require(isHeir[msg.sender], "Not heir");
        _;
    }

    modifier ownerActive() {
        require(block.timestamp <= lastCheckIn + inactivityPeriod, "Owner inactive");
        _;
    }

    modifier ownerInactive() {
        require(block.timestamp > lastCheckIn + inactivityPeriod, "Owner still active");
        _;
    }

    constructor(
        address _owner,
        string memory _planName,
        address[3] memory _verifiers,
        uint256 _inactivityPeriod
    ) {
        require(_owner != address(0), "Invalid owner");
        require(_inactivityPeriod >= MIN_INACTIVITY_PERIOD, "Period too short");
        require(
            _verifiers[0] != address(0) &&
            _verifiers[1] != address(0) &&
            _verifiers[2] != address(0),
            "Invalid verifier"
        );
        require(
            _verifiers[0] != _verifiers[1] &&
            _verifiers[0] != _verifiers[2] &&
            _verifiers[1] != _verifiers[2],
            "Duplicate verifiers"
        );
        require(
            _owner != _verifiers[0] &&
            _owner != _verifiers[1] &&
            _owner != _verifiers[2],
            "Owner cannot be verifier"
        );

        owner = _owner;
        planName = _planName;
        verifiers = _verifiers;
        inactivityPeriod = _inactivityPeriod;
        lastCheckIn = block.timestamp;
    }

    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    function checkIn() external onlyOwner ownerActive {
        lastCheckIn = block.timestamp;
        emit CheckedIn(block.timestamp);
    }

    function addHeir(
        address _wallet,
        uint256 _sharePercentage,
        ConditionType _condition,
        uint256 _ageThreshold,
        string calldata _conditionDetail
    ) external onlyOwner {
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
    }

    function removeHeir(address _wallet) external onlyOwner {
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

        emit HeirRemoved(_wallet);
    }

    function submitClaim(string calldata _documentCID) external onlyHeir ownerInactive {
        uint256 claimId = claims.length;
        claims.push(Claim({
            heir: msg.sender,
            documentCID: _documentCID,
            status: ClaimStatus.Pending,
            approvals: 0,
            rejections: 0,
            submittedAt: block.timestamp
        }));

        emit ClaimSubmitted(claimId, msg.sender, _documentCID);
    }

    function vote(uint256 _claimId, bool _approve) external onlyVerifier {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Pending, "Claim not pending");
        require(!verifierVoted[_claimId][msg.sender], "Already voted");

        verifierVoted[_claimId][msg.sender] = true;

        if (_approve) {
            claim.approvals++;
            emit ClaimVoted(_claimId, msg.sender, true);

            if (claim.approvals >= REQUIRED_APPROVALS) {
                claim.status = ClaimStatus.Approved;
                emit ClaimApproved(_claimId);
            }
        } else {
            claim.rejections++;
            emit ClaimVoted(_claimId, msg.sender, false);

            if (claim.rejections >= REQUIRED_APPROVALS) {
                claim.status = ClaimStatus.Rejected;
                emit ClaimRejected(_claimId);
            }
        }
    }

    function distribute(uint256 _claimId) external nonReentrant {
        require(_claimId < claims.length, "Invalid claim");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Approved, "Claim not approved");
        require(msg.sender == claim.heir, "Not claim heir");

        claim.status = ClaimStatus.Distributed;

        uint256 heirShare = heirs[heirIndex[claim.heir]].sharePercentage;
        uint256 amount = (address(this).balance * heirShare) / (BASIS_POINTS - distributedShare);
        distributedShare += heirShare;

        (bool success, ) = payable(claim.heir).call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsDistributed(_claimId, claim.heir, amount);
    }

    function withdrawFunds() external onlyOwner ownerActive nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(owner, balance);
    }

    // View functions
    function getHeirCount() external view returns (uint256) {
        return heirs.length;
    }

    function getAllHeirs() external view returns (Heir[] memory) {
        return heirs;
    }

    function getClaimCount() external view returns (uint256) {
        return claims.length;
    }

    function getClaimInfo(uint256 _claimId) external view returns (Claim memory) {
        require(_claimId < claims.length, "Invalid claim");
        return claims[_claimId];
    }

    function isOwnerInactive() external view returns (bool) {
        return block.timestamp > lastCheckIn + inactivityPeriod;
    }

    function timeUntilInactive() external view returns (uint256) {
        uint256 deadline = lastCheckIn + inactivityPeriod;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    function getPlanDetails() external view returns (
        address _owner,
        string memory _planName,
        address[3] memory _verifiers,
        uint256 _inactivityPeriod,
        uint256 _lastCheckIn,
        uint256 _balance,
        uint256 _heirCount,
        uint256 _claimCount,
        uint256 _totalShareAllocated,
        bool _isInactive
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
            block.timestamp > lastCheckIn + inactivityPeriod
        );
    }
}
