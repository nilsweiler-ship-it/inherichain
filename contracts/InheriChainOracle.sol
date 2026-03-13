// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title InheriChainOracle
 * @notice Chainlink Functions adapter for document verification.
 *
 * Flow:
 *  1. InheritancePlan (or heir) calls `requestValidation(planAddress, claimId, documentCID)`
 *  2. This contract sends a Chainlink Functions request that fetches the document from IPFS
 *     and runs basic validation logic (document type check, format validation, etc.)
 *  3. The Chainlink DON executes the JavaScript source off-chain and returns a boolean result.
 *  4. `fulfillRequest` is called by the Chainlink router with the result.
 *  5. The result is stored and the plan contract is notified.
 *
 * For MVP, the off-chain source validates:
 *   - Document CID is accessible on IPFS
 *   - Document is not empty
 *   - Basic format checks
 *
 * Post-MVP enhancements:
 *   - AI pre-screening of document content
 *   - Cross-referencing with government registries
 *   - Multi-document correlation
 */
contract InheriChainOracle is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    struct OracleRequest {
        address planAddress;
        uint256 claimId;
        string documentCID;
        bool fulfilled;
        bool validated;
        uint256 timestamp;
    }

    // Owner of this oracle contract (deployer)
    address public owner;

    // Chainlink Functions subscription ID
    uint64 public subscriptionId;

    // Gas limit for the Chainlink Functions callback
    uint32 public callbackGasLimit;

    // DON ID for Chainlink Functions
    bytes32 public donId;

    // JavaScript source code executed by Chainlink Functions DON
    string public functionsSource;

    // Request tracking
    mapping(bytes32 => OracleRequest) public requests;

    // Plan+claim => latest requestId
    mapping(address => mapping(uint256 => bytes32)) public planClaimRequestId;

    // Plan+claim => validation result
    mapping(address => mapping(uint256 => bool)) public validationResults;
    mapping(address => mapping(uint256 => bool)) public validationCompleted;

    // Authorized callers (InheritancePlan contracts)
    mapping(address => bool) public authorizedPlans;

    event ValidationRequested(bytes32 indexed requestId, address indexed plan, uint256 indexed claimId, string documentCID);
    event ValidationFulfilled(bytes32 indexed requestId, address indexed plan, uint256 indexed claimId, bool validated);
    event SourceUpdated(string newSource);
    event PlanAuthorized(address indexed plan);
    event PlanDeauthorized(address indexed plan);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _router,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit,
        bytes32 _donId,
        string memory _source
    ) FunctionsClient(_router) {
        owner = msg.sender;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
        donId = _donId;
        functionsSource = _source;
    }

    /**
     * @notice Request validation of a claim's document via Chainlink Functions.
     * @param _planAddress Address of the InheritancePlan contract
     * @param _claimId ID of the claim being validated
     * @param _documentCID IPFS CID of the document to validate
     */
    function requestValidation(
        address _planAddress,
        uint256 _claimId,
        string calldata _documentCID
    ) external returns (bytes32 requestId) {
        require(authorizedPlans[_planAddress] || msg.sender == owner, "Not authorized");

        // Build the Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(functionsSource);

        // Pass the document CID as an argument to the JavaScript source
        string[] memory args = new string[](3);
        args[0] = _documentCID;
        args[1] = _addressToString(_planAddress);
        args[2] = _uint256ToString(_claimId);
        req.setArgs(args);

        // Send the request
        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);

        // Store request details
        requests[requestId] = OracleRequest({
            planAddress: _planAddress,
            claimId: _claimId,
            documentCID: _documentCID,
            fulfilled: false,
            validated: false,
            timestamp: block.timestamp
        });

        planClaimRequestId[_planAddress][_claimId] = requestId;

        emit ValidationRequested(requestId, _planAddress, _claimId, _documentCID);
    }

    /**
     * @notice Callback from Chainlink Functions with the validation result.
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory /* err */
    ) internal override {
        OracleRequest storage req = requests[requestId];
        require(!req.fulfilled, "Already fulfilled");

        req.fulfilled = true;

        // Decode the response (expected: a single uint256 where 1 = valid, 0 = invalid)
        if (response.length > 0) {
            uint256 result = abi.decode(response, (uint256));
            req.validated = result == 1;
        } else {
            req.validated = false;
        }

        // Store result for the plan/claim
        validationResults[req.planAddress][req.claimId] = req.validated;
        validationCompleted[req.planAddress][req.claimId] = true;

        emit ValidationFulfilled(requestId, req.planAddress, req.claimId, req.validated);
    }

    // ===================== Admin Functions =====================

    function authorizePlan(address _plan) external onlyOwner {
        authorizedPlans[_plan] = true;
        emit PlanAuthorized(_plan);
    }

    function deauthorizePlan(address _plan) external onlyOwner {
        authorizedPlans[_plan] = false;
        emit PlanDeauthorized(_plan);
    }

    function updateSource(string calldata _source) external onlyOwner {
        functionsSource = _source;
        emit SourceUpdated(_source);
    }

    function updateSubscription(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function updateCallbackGasLimit(uint32 _callbackGasLimit) external onlyOwner {
        callbackGasLimit = _callbackGasLimit;
    }

    function updateDonId(bytes32 _donId) external onlyOwner {
        donId = _donId;
    }

    // ===================== View Functions =====================

    function getValidationResult(address _plan, uint256 _claimId) external view returns (bool completed, bool validated) {
        return (validationCompleted[_plan][_claimId], validationResults[_plan][_claimId]);
    }

    function getRequestInfo(bytes32 _requestId) external view returns (OracleRequest memory) {
        return requests[_requestId];
    }

    // ===================== Internal Helpers =====================

    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(_addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _uint256ToString(uint256 _value) internal pure returns (string memory) {
        if (_value == 0) return "0";
        uint256 temp = _value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (_value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_value % 10)));
            _value /= 10;
        }
        return string(buffer);
    }
}
