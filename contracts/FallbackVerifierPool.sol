// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FallbackVerifierPool
 * @notice Decentralized registry of ecosystem verifiers who can be assigned to plans
 * when the plan's original verifiers have all been slashed.
 *
 * Fallback verifiers:
 * - Register by staking a minimum bond (0.1 ETH)
 * - Get assigned to plans when requested
 * - Verify claims using anonymized documents (PII redacted)
 * - Earn fees from verification work
 */
contract FallbackVerifierPool is ReentrancyGuard {
    struct FallbackVerifier {
        address verifierAddress;
        uint256 stake;
        bool active;
        uint256 assignedPlans; // count of currently assigned plans
        uint256 registeredAt;
    }

    uint256 public constant MIN_STAKE = 0.1 ether;

    address public owner;
    address[] public verifierList;
    mapping(address => FallbackVerifier) public verifiers;
    mapping(address => bool) public isRegistered;

    // Round-robin index for fair assignment
    uint256 public assignmentIndex;

    // Plan => assigned fallback verifiers
    mapping(address => address[]) public planFallbackVerifiers;

    event VerifierRegistered(address indexed verifier, uint256 stake);
    event VerifierWithdrawn(address indexed verifier, uint256 stake);
    event FallbackVerifiersAssigned(address indexed plan, address[] verifiers);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register as a fallback verifier by staking at least MIN_STAKE.
     */
    function registerAsFallbackVerifier() external payable {
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(!isRegistered[msg.sender], "Already registered");

        verifiers[msg.sender] = FallbackVerifier({
            verifierAddress: msg.sender,
            stake: msg.value,
            active: true,
            assignedPlans: 0,
            registeredAt: block.timestamp
        });
        isRegistered[msg.sender] = true;
        verifierList.push(msg.sender);

        emit VerifierRegistered(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw from the pool (only if not currently assigned to any plans).
     */
    function withdrawFromPool() external nonReentrant {
        require(isRegistered[msg.sender], "Not registered");
        FallbackVerifier storage v = verifiers[msg.sender];
        require(v.assignedPlans == 0, "Currently assigned to plans");

        uint256 stake = v.stake;
        v.stake = 0;
        v.active = false;
        isRegistered[msg.sender] = false;

        // Remove from verifierList (swap and pop)
        for (uint256 i = 0; i < verifierList.length; i++) {
            if (verifierList[i] == msg.sender) {
                verifierList[i] = verifierList[verifierList.length - 1];
                verifierList.pop();
                break;
            }
        }

        (bool success, ) = payable(msg.sender).call{value: stake}("");
        require(success, "Transfer failed");

        emit VerifierWithdrawn(msg.sender, stake);
    }

    /**
     * @notice Request fallback verifiers for a plan.
     * Assigns verifiers in round-robin order.
     * @param _plan Address of the plan requesting fallback verifiers
     * @param _count Number of verifiers needed
     * @return assigned Array of assigned verifier addresses
     */
    function requestFallbackVerifiers(
        address _plan,
        uint256 _count
    ) external returns (address[] memory assigned) {
        require(_count > 0, "Count must be > 0");

        // Count active verifiers
        uint256 activeCount = 0;
        for (uint256 i = 0; i < verifierList.length; i++) {
            if (verifiers[verifierList[i]].active) {
                activeCount++;
            }
        }
        require(activeCount >= _count, "Not enough verifiers in pool");

        assigned = new address[](_count);
        uint256 assignedCount = 0;
        uint256 startIndex = assignmentIndex;

        // Round-robin assignment
        for (uint256 i = 0; i < verifierList.length && assignedCount < _count; i++) {
            uint256 idx = (startIndex + i) % verifierList.length;
            address v = verifierList[idx];

            if (verifiers[v].active) {
                // Check verifier isn't already assigned to this plan
                bool alreadyAssigned = false;
                address[] storage existing = planFallbackVerifiers[_plan];
                for (uint256 j = 0; j < existing.length; j++) {
                    if (existing[j] == v) {
                        alreadyAssigned = true;
                        break;
                    }
                }

                if (!alreadyAssigned) {
                    assigned[assignedCount] = v;
                    verifiers[v].assignedPlans++;
                    planFallbackVerifiers[_plan].push(v);
                    assignedCount++;
                }
            }
        }

        require(assignedCount == _count, "Could not assign enough verifiers");
        assignmentIndex = (startIndex + assignedCount) % verifierList.length;

        emit FallbackVerifiersAssigned(_plan, assigned);
    }

    /**
     * @notice Release a verifier from a plan assignment (called when verification is complete).
     */
    function releaseVerifier(address _plan, address _verifier) external {
        require(isRegistered[_verifier], "Not registered");
        FallbackVerifier storage v = verifiers[_verifier];
        if (v.assignedPlans > 0) {
            v.assignedPlans--;
        }

        // Remove from planFallbackVerifiers
        address[] storage assigned = planFallbackVerifiers[_plan];
        for (uint256 i = 0; i < assigned.length; i++) {
            if (assigned[i] == _verifier) {
                assigned[i] = assigned[assigned.length - 1];
                assigned.pop();
                break;
            }
        }
    }

    // ===================== View Functions =====================

    function getPoolSize() external view returns (uint256) {
        return verifierList.length;
    }

    function getActiveVerifierCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < verifierList.length; i++) {
            if (verifiers[verifierList[i]].active) {
                count++;
            }
        }
        return count;
    }

    function getPlanFallbackVerifiers(address _plan) external view returns (address[] memory) {
        return planFallbackVerifiers[_plan];
    }

    function getVerifierInfo(address _verifier) external view returns (FallbackVerifier memory) {
        return verifiers[_verifier];
    }

    function getAllVerifiers() external view returns (address[] memory) {
        return verifierList;
    }
}
