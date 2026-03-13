// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerifierRegistry {
    struct VerifierStats {
        uint256 plansVerified;
        uint256 votesCast;
        uint256 challengesReceived;
        uint256 challengesLost;
        uint256 bondsSlashed;
    }

    address public factory;
    mapping(address => bool) public authorizedPlans;
    mapping(address => VerifierStats) public stats;

    modifier onlyFactory() {
        require(msg.sender == factory, "Not factory");
        _;
    }

    modifier onlyAuthorizedPlan() {
        require(authorizedPlans[msg.sender], "Not authorized plan");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function authorizePlan(address _plan) external onlyFactory {
        authorizedPlans[_plan] = true;
    }

    function recordPlanVerified(address _verifier) external onlyAuthorizedPlan {
        stats[_verifier].plansVerified++;
    }

    function recordVoteCast(address _verifier) external onlyAuthorizedPlan {
        stats[_verifier].votesCast++;
    }

    function recordChallengeReceived(address _verifier) external onlyAuthorizedPlan {
        stats[_verifier].challengesReceived++;
    }

    function recordChallengeLost(address _verifier) external onlyAuthorizedPlan {
        stats[_verifier].challengesLost++;
    }

    function recordBondSlashed(address _verifier) external onlyAuthorizedPlan {
        stats[_verifier].bondsSlashed++;
    }

    function getStats(address _verifier) external view returns (VerifierStats memory) {
        return stats[_verifier];
    }

    function getReputation(address _verifier) external view returns (uint256) {
        VerifierStats memory s = stats[_verifier];
        uint256 positive = s.plansVerified * 10 + s.votesCast * 2;
        uint256 negative = s.challengesLost * 20 + s.bondsSlashed * 50;
        if (negative >= positive) return 0;
        return positive - negative;
    }
}
