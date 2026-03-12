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
        Distributed
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
        uint256 heirShare; // snapshot of heir's share at claim time
    }

    event HeirAdded(address indexed heir, uint256 sharePercentage, ConditionType condition);
    event HeirRemoved(address indexed heir);
    event CheckedIn(uint256 timestamp);
    event ClaimSubmitted(uint256 indexed claimId, address indexed heir, string documentCID);
    event ClaimVoted(uint256 indexed claimId, address indexed verifier, bool approved);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimRejected(uint256 indexed claimId);
    event FundsDistributed(uint256 indexed claimId, address indexed heir, uint256 amount);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
}
