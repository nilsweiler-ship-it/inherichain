import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { InheritancePlan, InheriChainFactory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";

/**
 * Oracle integration tests.
 * Since we can't deploy the real Chainlink Functions router in Hardhat,
 * we test the InheritancePlan-side oracle logic:
 * - setOracle
 * - recordOracleValidation
 * - Double confirmation (oracle + verifier approval required for finalizeApproval)
 */
describe("Oracle Integration", function () {
  let factory: InheriChainFactory;
  let plan: InheritancePlan;
  let owner: HardhatEthersSigner;
  let verifier1: HardhatEthersSigner;
  let verifier2: HardhatEthersSigner;
  let verifier3: HardhatEthersSigner;
  let heir1: HardhatEthersSigner;
  let oracleAccount: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let recovery: HardhatEthersSigner;

  const SIXTY_DAYS = 60 * 24 * 60 * 60;
  const ONE_DAY = 24 * 60 * 60;
  const BOND = ethers.parseEther("1");
  const CHALLENGE_STAKE = ethers.parseEther("0.5");

  function defaultConfig(recoveryAddr: string = ethers.ZeroAddress) {
    return {
      requiredApprovals: 2n,
      totalVerifiers: 3n,
      verifierBond: BOND,
      challengePeriod: BigInt(ONE_DAY),
      challengeStake: CHALLENGE_STAKE,
      gracePeriod: BigInt(7 * ONE_DAY),
      recoveryAddress: recoveryAddr,
      phase2Delay: 0n,
      phase3Delay: 0n,
      autoRelease: false,
    };
  }

  beforeEach(async function () {
    [owner, verifier1, verifier2, verifier3, heir1, oracleAccount, stranger, recovery] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("InheriChainFactory");
    factory = await Factory.deploy();

    const cfg = defaultConfig(recovery.address);
    const tx = await factory.connect(owner).createPlan(
      "Oracle Test Plan",
      [verifier1.address, verifier2.address, verifier3.address],
      SIXTY_DAYS,
      cfg
    );
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        return factory.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "PlanCreated";
      } catch { return false; }
    });
    const parsed = factory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
    plan = await ethers.getContractAt("InheritancePlan", parsed!.args.plan);

    // Stake verifiers
    for (const v of [verifier1, verifier2, verifier3]) {
      await plan.connect(v).stakeAsVerifier({ value: BOND });
    }

    // Add and accept heir
    await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "Death cert");
    await plan.connect(heir1).acceptInheritance();

    // Fund plan
    await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
  });

  describe("setOracle", function () {
    it("should set oracle address", async function () {
      await expect(plan.connect(owner).setOracle(oracleAccount.address))
        .to.emit(plan, "OracleSet")
        .withArgs(oracleAccount.address);
      expect(await plan.oracle()).to.equal(oracleAccount.address);
    });

    it("should reject zero address oracle", async function () {
      await expect(plan.connect(owner).setOracle(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid oracle");
    });

    it("should reject non-owner setting oracle", async function () {
      await expect(plan.connect(stranger).setOracle(oracleAccount.address))
        .to.be.revertedWith("Not owner");
    });
  });

  describe("recordOracleValidation", function () {
    beforeEach(async function () {
      await plan.connect(owner).setOracle(oracleAccount.address);
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmTestCID");
    });

    it("should record oracle validation", async function () {
      await expect(plan.connect(oracleAccount).recordOracleValidation(0, true))
        .to.emit(plan, "OracleValidationRecorded")
        .withArgs(0, true);
      expect(await plan.claimOracleValidated(0)).to.be.true;
    });

    it("should reject non-oracle caller", async function () {
      await expect(plan.connect(stranger).recordOracleValidation(0, true))
        .to.be.revertedWith("Not oracle");
    });

    it("should reject invalid claim ID", async function () {
      await expect(plan.connect(oracleAccount).recordOracleValidation(99, true))
        .to.be.revertedWith("Invalid claim");
    });
  });

  describe("Double Confirmation", function () {
    beforeEach(async function () {
      await plan.connect(owner).setOracle(oracleAccount.address);
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmTestCID");
      // Approve via verifiers
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      // Wait for challenge period
      await time.increase(ONE_DAY + 1);
    });

    it("should reject finalizeApproval without oracle validation", async function () {
      await expect(plan.finalizeApproval(0))
        .to.be.revertedWith("Oracle validation required");
    });

    it("should allow finalizeApproval with oracle validation", async function () {
      await plan.connect(oracleAccount).recordOracleValidation(0, true);
      await plan.finalizeApproval(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(6); // Distributing
    });

    it("should reject finalizeApproval when oracle rejects", async function () {
      await plan.connect(oracleAccount).recordOracleValidation(0, false);
      await expect(plan.finalizeApproval(0))
        .to.be.revertedWith("Oracle validation required");
    });
  });

  describe("No Oracle Set", function () {
    it("should allow finalizeApproval without oracle when none is set", async function () {
      // No oracle set — should work like before
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(6); // Distributing
    });
  });
});
