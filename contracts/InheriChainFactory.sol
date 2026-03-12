// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./InheritancePlan.sol";
import "./interfaces/IInheritancePlan.sol";

contract InheriChainFactory {
    address[] public allPlans;
    mapping(address => address[]) public ownerPlans;
    mapping(address => address[]) public heirPlans;
    mapping(address => address[]) public verifierPlans;
    mapping(address => mapping(address => bool)) private heirRegistered;

    event PlanCreated(address indexed plan, address indexed owner, string planName);
    event HeirRegistered(address indexed plan, address indexed heir);

    function createPlan(
        string calldata _planName,
        address[3] calldata _verifiers,
        uint256 _inactivityPeriod
    ) external returns (address) {
        InheritancePlan plan = new InheritancePlan(
            msg.sender,
            _planName,
            _verifiers,
            _inactivityPeriod
        );

        address planAddr = address(plan);
        allPlans.push(planAddr);
        ownerPlans[msg.sender].push(planAddr);

        for (uint256 i = 0; i < 3; i++) {
            verifierPlans[_verifiers[i]].push(planAddr);
        }

        emit PlanCreated(planAddr, msg.sender, _planName);
        return planAddr;
    }

    function registerHeir(address _plan, address _heir) external {
        require(_plan != address(0), "Invalid plan");
        require(_heir != address(0), "Invalid heir");
        InheritancePlan plan = InheritancePlan(payable(_plan));
        require(msg.sender == plan.owner(), "Only plan owner");
        require(plan.isHeir(_heir), "Not heir on plan");
        require(!heirRegistered[_heir][_plan], "Already registered");

        heirRegistered[_heir][_plan] = true;
        heirPlans[_heir].push(_plan);
        emit HeirRegistered(_plan, _heir);
    }

    function getOwnerPlans(address _owner) external view returns (address[] memory) {
        return ownerPlans[_owner];
    }

    function getHeirPlans(address _heir) external view returns (address[] memory) {
        return heirPlans[_heir];
    }

    function getVerifierPlans(address _verifier) external view returns (address[] memory) {
        return verifierPlans[_verifier];
    }

    function getAllPlans() external view returns (address[] memory) {
        return allPlans;
    }

    function getPlanCount() external view returns (uint256) {
        return allPlans.length;
    }
}
