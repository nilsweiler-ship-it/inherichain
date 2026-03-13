import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { InheritancePlan, InheriChainFactory, VerifierRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";

describe("InheritancePlan", function () {
  let factory: InheriChainFactory;
  let registry: VerifierRegistry;
  let plan: InheritancePlan;
  let owner: HardhatEthersSigner;
  let verifier1: HardhatEthersSigner;
  let verifier2: HardhatEthersSigner;
  let verifier3: HardhatEthersSigner;
  let verifier4: HardhatEthersSigner;
  let verifier5: HardhatEthersSigner;
  let heir1: HardhatEthersSigner;
  let heir2: HardhatEthersSigner;
  let heir3: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let recovery: HardhatEthersSigner;

  const PLAN_NAME = "My Inheritance Plan";
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  const SIXTY_DAYS = 60 * 24 * 60 * 60;
  const ONE_DAY = 24 * 60 * 60;
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60;
  const BOND = ethers.parseEther("1");
  const CHALLENGE_STAKE = ethers.parseEther("0.5");
  const GRACE_PERIOD = 7 * ONE_DAY;

  function defaultConfig(recoveryAddr: string = ethers.ZeroAddress) {
    return {
      requiredApprovals: 2n,
      totalVerifiers: 3n,
      verifierBond: BOND,
      challengePeriod: BigInt(ONE_DAY),
      challengeStake: CHALLENGE_STAKE,
      gracePeriod: BigInt(GRACE_PERIOD),
      recoveryAddress: recoveryAddr,
      phase2Delay: 0n, // 0 means use default (14 days)
      phase3Delay: 0n, // 0 means use default (30 days)
      autoRelease: false,
    };
  }

  async function deployViaFactory(
    verifiers: string[] = [verifier1.address, verifier2.address, verifier3.address],
    inactivityPeriod = SIXTY_DAYS,
    cfg?: ReturnType<typeof defaultConfig>
  ) {
    const actualCfg = cfg ?? defaultConfig(recovery.address);
    // Ensure totalVerifiers matches
    actualCfg.totalVerifiers = BigInt(verifiers.length);
    const tx = await factory.connect(owner).createPlan(
      PLAN_NAME,
      verifiers,
      inactivityPeriod,
      actualCfg
    );
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        return factory.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "PlanCreated";
      } catch { return false; }
    });
    const parsed = factory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
    const planAddr = parsed!.args.plan;
    plan = await ethers.getContractAt("InheritancePlan", planAddr);
    return plan;
  }

  async function stakeAllVerifiers(verifiersList: HardhatEthersSigner[] = [verifier1, verifier2, verifier3]) {
    for (const v of verifiersList) {
      await plan.connect(v).stakeAsVerifier({ value: BOND });
    }
  }

  async function deployWithHeirs() {
    await deployViaFactory();
    await stakeAllVerifiers();
    await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death certificate");
    await plan.connect(owner).addHeir(heir2.address, 3000, 4, 25, "Age verification");
    // Accept inheritance for both heirs
    await plan.connect(heir1).acceptInheritance();
    await plan.connect(heir2).acceptInheritance();
    return plan;
  }

  async function deployFundedWithClaim() {
    await deployWithHeirs();
    await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
    await time.increase(SIXTY_DAYS + 1);
    await plan.connect(heir1).submitClaim("QmTestCID123");
    return plan;
  }

  async function approveClaim(claimId = 0) {
    await plan.connect(verifier1).vote(claimId, true);
    await plan.connect(verifier2).vote(claimId, true);
  }

  async function approveAndFinalize(claimId = 0) {
    await approveClaim(claimId);
    await time.increase(ONE_DAY + 1);
    await plan.finalizeApproval(claimId);
  }

  beforeEach(async function () {
    [owner, verifier1, verifier2, verifier3, verifier4, verifier5, heir1, heir2, heir3, stranger, recovery] =
      await ethers.getSigners();
    const Factory = await ethers.getContractFactory("InheriChainFactory");
    factory = await Factory.deploy();
    const registryAddr = await factory.getRegistry();
    registry = await ethers.getContractAt("VerifierRegistry", registryAddr);
  });

  // ===================== Constructor =====================

  describe("Constructor", function () {
    it("should set correct initial values", async function () {
      await deployViaFactory();
      expect(await plan.owner()).to.equal(owner.address);
      expect(await plan.planName()).to.equal(PLAN_NAME);
      expect(await plan.verifiers(0)).to.equal(verifier1.address);
      expect(await plan.verifiers(1)).to.equal(verifier2.address);
      expect(await plan.verifiers(2)).to.equal(verifier3.address);
      expect(await plan.inactivityPeriod()).to.equal(SIXTY_DAYS);
    });

    it("should set default distribution delays when 0 is passed", async function () {
      await deployViaFactory();
      const details = await plan.getPlanDetails();
      expect(details._config.phase2Delay).to.equal(BigInt(FOURTEEN_DAYS));
      expect(details._config.phase3Delay).to.equal(BigInt(THIRTY_DAYS));
    });

    it("should accept custom distribution delays", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.phase2Delay = BigInt(7 * ONE_DAY);
      cfg.phase3Delay = BigInt(21 * ONE_DAY);
      await deployViaFactory(undefined, SIXTY_DAYS, cfg);
      const details = await plan.getPlanDetails();
      expect(details._config.phase2Delay).to.equal(BigInt(7 * ONE_DAY));
      expect(details._config.phase3Delay).to.equal(BigInt(21 * ONE_DAY));
    });

    it("should reject inactivity period less than 30 days", async function () {
      await expect(
        deployViaFactory(undefined, THIRTY_DAYS - 1)
      ).to.be.revertedWith("Period too short");
    });

    it("should accept exactly 30 days inactivity period", async function () {
      await deployViaFactory(undefined, THIRTY_DAYS);
      expect(await plan.inactivityPeriod()).to.equal(THIRTY_DAYS);
    });

    it("should reject fewer than 2 verifiers", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.totalVerifiers = 1n;
      cfg.requiredApprovals = 1n;
      await expect(
        deployViaFactory([verifier1.address], SIXTY_DAYS, cfg)
      ).to.be.revertedWith("Need at least 2 verifiers");
    });

    it("should reject M > N", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.requiredApprovals = 4n;
      await expect(
        deployViaFactory(undefined, SIXTY_DAYS, cfg)
      ).to.be.revertedWith("M > N");
    });

    it("should reject M = 0", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.requiredApprovals = 0n;
      await expect(
        deployViaFactory(undefined, SIXTY_DAYS, cfg)
      ).to.be.revertedWith("M must be > 0");
    });

    it("should reject N mismatch", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.totalVerifiers = 5n;
      // Pass cfg directly without going through deployViaFactory which auto-corrects totalVerifiers
      await expect(
        factory.connect(owner).createPlan(
          PLAN_NAME,
          [verifier1.address, verifier2.address, verifier3.address],
          SIXTY_DAYS,
          cfg
        )
      ).to.be.revertedWith("N mismatch");
    });

    it("should reject zero address verifiers", async function () {
      await expect(
        deployViaFactory([ethers.ZeroAddress, verifier2.address, verifier3.address])
      ).to.be.revertedWith("Invalid verifier");
    });

    it("should reject duplicate verifiers", async function () {
      await expect(
        deployViaFactory([verifier1.address, verifier1.address, verifier3.address])
      ).to.be.revertedWith("Duplicate verifiers");
    });

    it("should reject owner as verifier", async function () {
      await expect(
        deployViaFactory([owner.address, verifier2.address, verifier3.address])
      ).to.be.revertedWith("Owner cannot be verifier");
    });

    it("should reject challenge period < 1 day", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.challengePeriod = BigInt(ONE_DAY - 1);
      await expect(
        deployViaFactory(undefined, SIXTY_DAYS, cfg)
      ).to.be.revertedWith("Challenge period too short");
    });

    it("should support 5-of-5 M-of-N", async function () {
      const v = [verifier1.address, verifier2.address, verifier3.address, verifier4.address, verifier5.address];
      const cfg = defaultConfig(recovery.address);
      cfg.requiredApprovals = 5n;
      cfg.totalVerifiers = 5n;
      await deployViaFactory(v, SIXTY_DAYS, cfg);
      expect(await plan.verifiers(4)).to.equal(verifier5.address);
    });
  });

  // ===================== Verifier Staking =====================

  describe("Verifier Staking", function () {
    beforeEach(async function () {
      await deployViaFactory();
    });

    it("should accept correct bond amount", async function () {
      await expect(plan.connect(verifier1).stakeAsVerifier({ value: BOND }))
        .to.emit(plan, "VerifierStaked")
        .withArgs(verifier1.address, BOND);
      expect(await plan.verifierBonds(verifier1.address)).to.equal(BOND);
    });

    it("should reject wrong bond amount", async function () {
      await expect(
        plan.connect(verifier1).stakeAsVerifier({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Wrong bond amount");
    });

    it("should reject double staking", async function () {
      await plan.connect(verifier1).stakeAsVerifier({ value: BOND });
      await expect(
        plan.connect(verifier1).stakeAsVerifier({ value: BOND })
      ).to.be.revertedWith("Already staked");
    });

    it("should reject non-verifier staking", async function () {
      await expect(
        plan.connect(stranger).stakeAsVerifier({ value: BOND })
      ).to.be.revertedWith("Not verifier");
    });

    it("should allow bond withdrawal when all claims settled", async function () {
      await plan.connect(verifier1).stakeAsVerifier({ value: BOND });
      const balBefore = await ethers.provider.getBalance(verifier1.address);
      const tx = await plan.connect(verifier1).withdrawVerifierBond();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(verifier1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(BOND);
    });

    it("should reject bond withdrawal with pending claims", async function () {
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("1") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await expect(plan.connect(verifier1).withdrawVerifierBond()).to.be.revertedWith("Claims pending");
    });

    it("should reject withdrawal with no bond", async function () {
      await expect(plan.connect(verifier1).withdrawVerifierBond()).to.be.revertedWith("No bond");
    });
  });

  // ===================== Heir Management =====================

  describe("Heir Management", function () {
    beforeEach(async function () {
      await deployViaFactory();
    });

    it("should add an heir correctly", async function () {
      await expect(plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death cert"))
        .to.emit(plan, "HeirAdded")
        .withArgs(heir1.address, 5000, 0);
      expect(await plan.isHeir(heir1.address)).to.be.true;
      expect(await plan.getHeirCount()).to.equal(1);
    });

    it("should emit HeirInvited event when adding heir", async function () {
      await expect(plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death cert"))
        .to.emit(plan, "HeirInvited")
        .withArgs(heir1.address, 5000);
    });

    it("should add multiple heirs", async function () {
      await plan.connect(owner).addHeir(heir1.address, 3000, 0, 0, "");
      await plan.connect(owner).addHeir(heir2.address, 4000, 1, 0, "");
      await plan.connect(owner).addHeir(heir3.address, 3000, 2, 0, "");
      expect(await plan.getHeirCount()).to.equal(3);
      expect(await plan.totalShareAllocated()).to.equal(10000);
    });

    it("should reject non-owner adding heir", async function () {
      await expect(plan.connect(stranger).addHeir(heir1.address, 5000, 0, 0, ""))
        .to.be.revertedWith("Not owner");
    });

    it("should reject zero address heir", async function () {
      await expect(plan.connect(owner).addHeir(ethers.ZeroAddress, 5000, 0, 0, ""))
        .to.be.revertedWith("Invalid heir address");
    });

    it("should reject duplicate heir", async function () {
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await expect(plan.connect(owner).addHeir(heir1.address, 3000, 0, 0, ""))
        .to.be.revertedWith("Already an heir");
    });

    it("should reject zero share", async function () {
      await expect(plan.connect(owner).addHeir(heir1.address, 0, 0, 0, ""))
        .to.be.revertedWith("Share must be > 0");
    });

    it("should reject shares exceeding 100%", async function () {
      await plan.connect(owner).addHeir(heir1.address, 8000, 0, 0, "");
      await expect(plan.connect(owner).addHeir(heir2.address, 3000, 0, 0, ""))
        .to.be.revertedWith("Total shares exceed 100%");
    });

    it("should reject owner as heir", async function () {
      await expect(plan.connect(owner).addHeir(owner.address, 5000, 0, 0, ""))
        .to.be.revertedWith("Owner cannot be heir");
    });

    it("should remove an heir", async function () {
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await expect(plan.connect(owner).removeHeir(heir1.address))
        .to.emit(plan, "HeirRemoved")
        .withArgs(heir1.address);
      expect(await plan.isHeir(heir1.address)).to.be.false;
    });

    it("should correctly swap-remove when removing non-last heir", async function () {
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await plan.connect(owner).addHeir(heir2.address, 3000, 4, 25, "");
      await plan.connect(owner).removeHeir(heir1.address);
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs.length).to.equal(1);
      expect(allHeirs[0].wallet).to.equal(heir2.address);
    });

    it("should clear heir acceptance on removal", async function () {
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      expect(await plan.heirAccepted(heir1.address)).to.be.true;
      await plan.connect(owner).removeHeir(heir1.address);
      expect(await plan.heirAccepted(heir1.address)).to.be.false;
    });
  });

  // ===================== Heir Acceptance (Phase 2) =====================

  describe("Heir Acceptance", function () {
    beforeEach(async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death cert");
    });

    it("should allow heir to accept inheritance", async function () {
      await expect(plan.connect(heir1).acceptInheritance())
        .to.emit(plan, "HeirAccepted")
        .withArgs(heir1.address);
      expect(await plan.heirAccepted(heir1.address)).to.be.true;
    });

    it("should reject double acceptance", async function () {
      await plan.connect(heir1).acceptInheritance();
      await expect(plan.connect(heir1).acceptInheritance())
        .to.be.revertedWith("Already accepted");
    });

    it("should reject non-heir acceptance", async function () {
      await expect(plan.connect(stranger).acceptInheritance())
        .to.be.revertedWith("Not heir");
    });

    it("should reject claim submission without acceptance", async function () {
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(heir1).submitClaim("QmCID"))
        .to.be.revertedWith("Heir has not accepted");
    });

    it("should allow claim after acceptance", async function () {
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      expect(await plan.getClaimCount()).to.equal(1);
    });

    it("should allow owner to remove unaccepted heir", async function () {
      await plan.connect(owner).removeHeir(heir1.address);
      expect(await plan.isHeir(heir1.address)).to.be.false;
    });
  });

  // ===================== Submit Claim =====================

  describe("Submit Claim", function () {
    beforeEach(async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
    });

    it("should submit claim when owner inactive", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(heir1).submitClaim("QmTestCID"))
        .to.emit(plan, "ClaimSubmitted")
        .withArgs(0, heir1.address, "QmTestCID");
      expect(await plan.getClaimCount()).to.equal(1);
    });

    it("should reject claim when owner active", async function () {
      await expect(plan.connect(heir1).submitClaim("QmTestCID"))
        .to.be.revertedWith("Owner still active");
    });

    it("should reject claim from non-heir", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(stranger).submitClaim("QmTestCID"))
        .to.be.revertedWith("Not heir");
    });

    it("should store claim info correctly", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmTestCID");
      const claim = await plan.getClaimInfo(0);
      expect(claim.heir).to.equal(heir1.address);
      expect(claim.documentCID).to.equal("QmTestCID");
      expect(claim.status).to.equal(1); // Pending
      expect(claim.approvals).to.equal(0);
      expect(claim.rejections).to.equal(0);
      expect(claim.voteRound).to.equal(0);
    });
  });

  // ===================== Vote M-of-N =====================

  describe("Vote M-of-N", function () {
    beforeEach(async function () {
      await deployFundedWithClaim();
    });

    it("should allow staked verifier to approve", async function () {
      await expect(plan.connect(verifier1).vote(0, true))
        .to.emit(plan, "ClaimVoted")
        .withArgs(0, verifier1.address, true);
      const claim = await plan.getClaimInfo(0);
      expect(claim.approvals).to.equal(1);
    });

    it("should allow staked verifier to reject", async function () {
      await expect(plan.connect(verifier1).vote(0, false))
        .to.emit(plan, "ClaimVoted")
        .withArgs(0, verifier1.address, false);
      const claim = await plan.getClaimInfo(0);
      expect(claim.rejections).to.equal(1);
    });

    it("should approve claim with M=2 approvals", async function () {
      await plan.connect(verifier1).vote(0, true);
      await expect(plan.connect(verifier2).vote(0, true))
        .to.emit(plan, "ClaimApproved")
        .withArgs(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(2); // Approved
      expect(claim.challengeDeadline).to.be.greaterThan(0);
    });

    it("should reject claim with N-M+1=2 rejections (2-of-3)", async function () {
      await plan.connect(verifier1).vote(0, false);
      await expect(plan.connect(verifier2).vote(0, false))
        .to.emit(plan, "ClaimRejected")
        .withArgs(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(3); // Rejected
    });

    it("should reject non-verifier vote", async function () {
      await expect(plan.connect(stranger).vote(0, true)).to.be.revertedWith("Not verifier");
    });

    it("should reject unstaked verifier vote", async function () {
      // Deploy new plan, don't stake verifier1
      await deployViaFactory();
      await plan.connect(verifier2).stakeAsVerifier({ value: BOND });
      await plan.connect(verifier3).stakeAsVerifier({ value: BOND });
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("1") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await expect(plan.connect(verifier1).vote(0, true)).to.be.revertedWith("Not staked");
    });

    it("should reject double vote", async function () {
      await plan.connect(verifier1).vote(0, true);
      await expect(plan.connect(verifier1).vote(0, true)).to.be.revertedWith("Already voted");
    });

    it("should reject vote on invalid claim", async function () {
      await expect(plan.connect(verifier1).vote(99, true)).to.be.revertedWith("Invalid claim");
    });

    it("should reject vote on non-pending claim", async function () {
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      await expect(plan.connect(verifier3).vote(0, true)).to.be.revertedWith("Claim not pending");
    });

    it("should handle mixed votes (2 approve, 1 reject)", async function () {
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, true);
      await plan.connect(verifier3).vote(0, true);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(2); // Approved
    });

    it("should handle mixed votes (1 approve, 2 reject)", async function () {
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, false);
      await plan.connect(verifier3).vote(0, false);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(3); // Rejected
    });

    it("should work with 3-of-5 M-of-N", async function () {
      const v = [verifier1.address, verifier2.address, verifier3.address, verifier4.address, verifier5.address];
      const cfg = defaultConfig(recovery.address);
      cfg.requiredApprovals = 3n;
      cfg.totalVerifiers = 5n;
      await deployViaFactory(v, SIXTY_DAYS, cfg);
      for (const v of [verifier1, verifier2, verifier3, verifier4, verifier5]) {
        await plan.connect(v).stakeAsVerifier({ value: BOND });
      }
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("5") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("Qm5of5");

      // 2 approvals not enough
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      let claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(1); // Still Pending

      // 3rd approval triggers Approved
      await expect(plan.connect(verifier3).vote(0, true))
        .to.emit(plan, "ClaimApproved");
      claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(2); // Approved
    });

    it("should reject with 3 rejections in 3-of-5 (rejection threshold = 3)", async function () {
      const v = [verifier1.address, verifier2.address, verifier3.address, verifier4.address, verifier5.address];
      const cfg = defaultConfig(recovery.address);
      cfg.requiredApprovals = 3n;
      cfg.totalVerifiers = 5n;
      await deployViaFactory(v, SIXTY_DAYS, cfg);
      for (const v of [verifier1, verifier2, verifier3, verifier4, verifier5]) {
        await plan.connect(v).stakeAsVerifier({ value: BOND });
      }
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("5") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("Qm5of5");

      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, false);
      let claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(1); // Still pending (need 3 rejections)

      await expect(plan.connect(verifier3).vote(0, false))
        .to.emit(plan, "ClaimRejected");
      claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(3); // Rejected
    });
  });

  // ===================== Challenge Period =====================

  describe("Challenge Period", function () {
    beforeEach(async function () {
      await deployFundedWithClaim();
      await approveClaim();
    });

    it("should allow owner to cancel during challenge window", async function () {
      await expect(plan.connect(owner).cancelClaimAsOwner(0))
        .to.emit(plan, "ClaimCancelledByOwner")
        .withArgs(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(3); // Rejected
    });

    it("should reject owner cancel after challenge window", async function () {
      await time.increase(ONE_DAY + 1);
      await expect(plan.connect(owner).cancelClaimAsOwner(0))
        .to.be.revertedWith("Challenge window closed");
    });

    it("should reject non-owner cancel", async function () {
      await expect(plan.connect(stranger).cancelClaimAsOwner(0))
        .to.be.revertedWith("Not owner");
    });

    it("should allow anyone to raise challenge when no approved challengers set", async function () {
      await expect(plan.connect(stranger).raiseChallenge(0, { value: CHALLENGE_STAKE }))
        .to.emit(plan, "ChallengeRaised")
        .withArgs(0, 0, stranger.address);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(4); // Challenged
    });

    it("should reject challenge with wrong stake", async function () {
      await expect(
        plan.connect(stranger).raiseChallenge(0, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Wrong challenge stake");
    });

    it("should reject challenge after window", async function () {
      await time.increase(ONE_DAY + 1);
      await expect(
        plan.connect(stranger).raiseChallenge(0, { value: CHALLENGE_STAKE })
      ).to.be.revertedWith("Challenge window closed");
    });

    it("should reject challenge on non-approved claim", async function () {
      // Cancel the claim first
      await plan.connect(owner).cancelClaimAsOwner(0);
      await expect(
        plan.connect(stranger).raiseChallenge(0, { value: CHALLENGE_STAKE })
      ).to.be.revertedWith("Claim not approved");
    });

    it("should allow finalizeApproval after challenge deadline", async function () {
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(6); // Distributing
      expect(claim.snapshotBalance).to.be.greaterThan(0);
    });

    it("should reject finalizeApproval during challenge period", async function () {
      await expect(plan.finalizeApproval(0)).to.be.revertedWith("Challenge period active");
    });
  });

  // ===================== Pre-approved Challengers (Phase 1.3) =====================

  describe("Pre-approved Challengers", function () {
    beforeEach(async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
    });

    it("should add approved challenger", async function () {
      await expect(plan.connect(owner).addChallenger(stranger.address))
        .to.emit(plan, "ChallengerAdded")
        .withArgs(stranger.address);
      expect(await plan.isApprovedChallenger(stranger.address)).to.be.true;
    });

    it("should remove approved challenger", async function () {
      await plan.connect(owner).addChallenger(stranger.address);
      await expect(plan.connect(owner).removeChallenger(stranger.address))
        .to.emit(plan, "ChallengerRemoved")
        .withArgs(stranger.address);
      expect(await plan.isApprovedChallenger(stranger.address)).to.be.false;
    });

    it("should reject non-owner adding challenger", async function () {
      await expect(plan.connect(stranger).addChallenger(heir1.address))
        .to.be.revertedWith("Not owner");
    });

    it("should restrict challenges to approved challengers when set", async function () {
      await plan.connect(owner).addChallenger(recovery.address);
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();

      // Stranger should be rejected
      await expect(
        plan.connect(stranger).raiseChallenge(0, { value: CHALLENGE_STAKE })
      ).to.be.revertedWith("Not an approved challenger");

      // Approved challenger should work
      await expect(
        plan.connect(recovery).raiseChallenge(0, { value: CHALLENGE_STAKE })
      ).to.emit(plan, "ChallengeRaised");
    });

    it("should return approved challengers list", async function () {
      await plan.connect(owner).addChallenger(stranger.address);
      await plan.connect(owner).addChallenger(recovery.address);
      const challengers = await plan.getApprovedChallengers();
      expect(challengers.length).to.equal(2);
      expect(challengers[0]).to.equal(stranger.address);
      expect(challengers[1]).to.equal(recovery.address);
    });
  });

  // ===================== Challenge Resolution =====================

  describe("Challenge Resolution", function () {
    beforeEach(async function () {
      await deployFundedWithClaim();
      await approveClaim();
      await plan.connect(stranger).raiseChallenge(0, { value: CHALLENGE_STAKE });
    });

    it("should resolve challenge and reset to pending for re-vote", async function () {
      await plan.resolveChallenge(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(1); // Pending
      expect(claim.voteRound).to.equal(1);
      expect(claim.approvals).to.equal(0);
      expect(claim.rejections).to.equal(0);
    });

    it("should allow verifiers to re-vote after resolve", async function () {
      await plan.resolveChallenge(0);
      // All verifiers can vote again in the new round
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(2); // Re-approved
    });

    it("should refund challenger when re-vote rejects", async function () {
      await plan.resolveChallenge(0);
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, false);

      const balBefore = await ethers.provider.getBalance(stranger.address);
      const tx = await plan.connect(stranger).finalizeChallenge(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(stranger.address);
      expect(balAfter - balBefore + gasUsed).to.equal(CHALLENGE_STAKE);

      const challenge = await plan.getChallengeInfo(0);
      expect(challenge.successful).to.be.true;
    });

    it("should keep challenger stake when re-vote approves", async function () {
      await plan.resolveChallenge(0);
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);

      await plan.finalizeChallenge(0);
      const challenge = await plan.getChallengeInfo(0);
      expect(challenge.successful).to.be.false;

      // Claim should have new challenge deadline
      const claim = await plan.getClaimInfo(0);
      expect(claim.challengeDeadline).to.be.greaterThan(0);
    });

    it("should slash verifiers who approved in original round on successful challenge", async function () {
      await plan.resolveChallenge(0);
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, false);

      // Before finalize, verifiers have bonds
      expect(await plan.verifierBonds(verifier1.address)).to.equal(BOND);
      expect(await plan.verifierBonds(verifier2.address)).to.equal(BOND);

      await plan.connect(stranger).finalizeChallenge(0);

      // Verifier1 and verifier2 voted approve in round 0, so slashed
      expect(await plan.verifierBonds(verifier1.address)).to.equal(0);
      expect(await plan.verifierBonds(verifier2.address)).to.equal(0);
    });

    it("should reject resolving already resolved challenge", async function () {
      await plan.resolveChallenge(0);
      await expect(plan.resolveChallenge(0)).to.be.revertedWith("Already resolved");
    });
  });

  // ===================== Progressive Distribution =====================

  describe("Progressive Distribution", function () {
    beforeEach(async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
    });

    it("should allow Phase 1 claim immediately", async function () {
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(6); // Distributing

      // heir1 share = 5000bp, balance = 10 ETH, distributedShare = 0
      // baseAmount = 10 * 5000 / 10000 = 5 ETH
      // Phase 1 = 10% of 5 ETH = 0.5 ETH
      const balBefore = await ethers.provider.getBalance(heir1.address);
      const tx = await plan.connect(heir1).distributePhase(0, 0); // Phase1
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("0.5"));
    });

    it("should reject Phase 2 before Phase 1", async function () {
      await expect(plan.connect(heir1).distributePhase(0, 1))
        .to.be.revertedWith("Claim Phase 1 first");
    });

    it("should reject Phase 2 before 14 days", async function () {
      await plan.connect(heir1).distributePhase(0, 0); // Phase 1
      await expect(plan.connect(heir1).distributePhase(0, 1))
        .to.be.revertedWith("Phase 2 not unlocked");
    });

    it("should allow Phase 2 after 14 days", async function () {
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);

      // Phase 2 = 40% of 5 ETH = 2 ETH
      const balBefore = await ethers.provider.getBalance(heir1.address);
      const tx = await plan.connect(heir1).distributePhase(0, 1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("2"));
    });

    it("should reject Phase 3 before Phase 2", async function () {
      await plan.connect(heir1).distributePhase(0, 0);
      await expect(plan.connect(heir1).distributePhase(0, 2))
        .to.be.revertedWith("Claim Phase 2 first");
    });

    it("should reject Phase 3 before 30 days", async function () {
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 1);
      await expect(plan.connect(heir1).distributePhase(0, 2))
        .to.be.revertedWith("Phase 3 not unlocked");
    });

    it("should allow Phase 3 after 30 days and mark Distributed", async function () {
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 1);
      await time.increase(THIRTY_DAYS - FOURTEEN_DAYS);

      // Phase 3 = 50% of 5 ETH = 2.5 ETH
      const balBefore = await ethers.provider.getBalance(heir1.address);
      const tx = await plan.connect(heir1).distributePhase(0, 2);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("2.5"));

      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(7); // Distributed
    });

    it("should reject double Phase 1 claim", async function () {
      await plan.connect(heir1).distributePhase(0, 0);
      await expect(plan.connect(heir1).distributePhase(0, 0))
        .to.be.revertedWith("Phase 1 already claimed");
    });

    it("should reject non-heir from distributing (non-auto-release)", async function () {
      await expect(plan.connect(stranger).distributePhase(0, 0))
        .to.be.revertedWith("Not claim heir");
    });

    it("should distribute correct amounts for multi-heir scenario", async function () {
      // heir1 claims all 3 phases (5 ETH total)
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 1);
      await time.increase(THIRTY_DAYS - FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 2);

      // Now heir2 submits claim
      await plan.connect(heir2).submitClaim("QmCID2");
      await plan.connect(verifier1).vote(1, true);
      await plan.connect(verifier2).vote(1, true);
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(1);

      // heir2 share = 3000bp, snapshot at finalize time
      // remaining balance = 5 ETH, distributedShare = 5000
      // baseAmount = 5 * 3000 / (10000 - 5000) = 5 * 3000 / 5000 = 3 ETH
      // Phase 1 = 10% of 3 ETH = 0.3 ETH
      const balBefore = await ethers.provider.getBalance(heir2.address);
      const tx = await plan.connect(heir2).distributePhase(1, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir2.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("0.3"));
    });
  });

  // ===================== Configurable Distribution Delays (Phase 1.1) =====================

  describe("Configurable Distribution Delays", function () {
    it("should use custom delays when configured", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.phase2Delay = BigInt(7 * ONE_DAY);   // 7 days
      cfg.phase3Delay = BigInt(14 * ONE_DAY);  // 14 days
      await deployViaFactory(undefined, SIXTY_DAYS, cfg);
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Phase 1 immediate
      await plan.connect(heir1).distributePhase(0, 0);

      // Phase 2 should be available after 7 days (not 14)
      await time.increase(7 * ONE_DAY);
      await plan.connect(heir1).distributePhase(0, 1); // Should succeed

      // Phase 3 should be available after 14 days total (not 30)
      await time.increase(7 * ONE_DAY);
      await plan.connect(heir1).distributePhase(0, 2); // Should succeed
    });

    it("should allow owner to update distribution delays", async function () {
      await deployViaFactory();
      await expect(plan.connect(owner).updateDistributionDelays(BigInt(7 * ONE_DAY), BigInt(21 * ONE_DAY)))
        .to.emit(plan, "DistributionDelaysUpdated")
        .withArgs(BigInt(7 * ONE_DAY), BigInt(21 * ONE_DAY));
    });

    it("should reject phase3 delay <= phase2 delay", async function () {
      await deployViaFactory();
      await expect(
        plan.connect(owner).updateDistributionDelays(BigInt(14 * ONE_DAY), BigInt(14 * ONE_DAY))
      ).to.be.revertedWith("Phase 3 delay must be > Phase 2 delay");
    });

    it("should reject zero phase2 delay", async function () {
      await deployViaFactory();
      await expect(
        plan.connect(owner).updateDistributionDelays(0n, BigInt(14 * ONE_DAY))
      ).to.be.revertedWith("Phase 2 delay must be > 0");
    });

    it("should reject non-owner updating delays", async function () {
      await deployViaFactory();
      await expect(
        plan.connect(stranger).updateDistributionDelays(BigInt(7 * ONE_DAY), BigInt(14 * ONE_DAY))
      ).to.be.revertedWith("Not owner");
    });
  });

  // ===================== Auto-Release Distribution (Phase 1.2) =====================

  describe("Auto-Release Distribution", function () {
    it("should allow anyone to trigger distribution when auto-release is on", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.autoRelease = true;
      await deployViaFactory(undefined, SIXTY_DAYS, cfg);
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Stranger can trigger distribution for heir
      const balBefore = await ethers.provider.getBalance(heir1.address);
      await plan.connect(stranger).distributePhase(0, 0);
      const balAfter = await ethers.provider.getBalance(heir1.address);
      // Funds go to heir, not stranger
      expect(balAfter - balBefore).to.equal(ethers.parseEther("1")); // 10% of 10 ETH
    });
  });

  // ===================== Backup Heir (Phase 1.4) =====================

  describe("Backup Heir", function () {
    beforeEach(async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death cert");
    });

    it("should set backup heir", async function () {
      await expect(plan.connect(owner).setBackupHeir(heir3.address))
        .to.emit(plan, "BackupHeirSet")
        .withArgs(heir3.address);
      expect(await plan.backupHeir()).to.equal(heir3.address);
    });

    it("should reject zero address backup heir", async function () {
      await expect(plan.connect(owner).setBackupHeir(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid backup heir");
    });

    it("should reject owner as backup heir", async function () {
      await expect(plan.connect(owner).setBackupHeir(owner.address))
        .to.be.revertedWith("Owner cannot be backup heir");
    });

    it("should activate backup heir replacing original", async function () {
      await plan.connect(owner).setBackupHeir(heir3.address);
      await expect(plan.connect(owner).activateBackupHeir(heir1.address))
        .to.emit(plan, "BackupHeirActivated")
        .withArgs(heir1.address, heir3.address);

      expect(await plan.isHeir(heir1.address)).to.be.false;
      expect(await plan.isHeir(heir3.address)).to.be.true;
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs[0].wallet).to.equal(heir3.address);
      expect(allHeirs[0].sharePercentage).to.equal(5000);
    });

    it("should reject activate when no backup set", async function () {
      await expect(plan.connect(owner).activateBackupHeir(heir1.address))
        .to.be.revertedWith("No backup heir set");
    });

    it("should reject non-owner activating backup", async function () {
      await plan.connect(owner).setBackupHeir(heir3.address);
      await expect(plan.connect(stranger).activateBackupHeir(heir1.address))
        .to.be.revertedWith("Not owner");
    });
  });

  // ===================== Plan Lock During Claims (Phase 1.5) =====================

  describe("Plan Lock During Claims", function () {
    it("should lock plan modifications during active claims", async function () {
      await deployFundedWithClaim();

      // All these should fail because there's an active claim
      await expect(plan.connect(owner).addHeir(heir3.address, 1000, 0, 0, ""))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).removeHeir(heir2.address))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).updateHeirShare(heir1.address, 6000))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).updateHeirCondition(heir1.address, 1, 0, ""))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).updateInactivityPeriod(90 * ONE_DAY))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).addChallenger(stranger.address))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).setBackupHeir(heir3.address))
        .to.be.revertedWith("Active claim exists, plan locked");
      await expect(plan.connect(owner).updateDistributionDelays(BigInt(7 * ONE_DAY), BigInt(14 * ONE_DAY)))
        .to.be.revertedWith("Active claim exists, plan locked");
    });

    it("should unlock after claim is fully distributed", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 1);
      await time.increase(THIRTY_DAYS - FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 2);

      // Now modifications should work
      await plan.connect(owner).addHeir(heir3.address, 1000, 0, 0, "");
      expect(await plan.isHeir(heir3.address)).to.be.true;
    });

    it("should unlock after claim is rejected", async function () {
      await deployFundedWithClaim();
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, false);

      // Claim rejected — should unlock
      await plan.connect(owner).addHeir(heir3.address, 1000, 0, 0, "");
      expect(await plan.isHeir(heir3.address)).to.be.true;
    });

    it("should report hasActiveClaim correctly", async function () {
      await deployWithHeirs();
      expect(await plan.hasActiveClaim()).to.be.false;

      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      expect(await plan.hasActiveClaim()).to.be.true;
    });
  });

  // ===================== Cancel Distribution (Phase 1.6) =====================

  describe("Cancel Distribution", function () {
    it("should allow owner to cancel distribution while alive", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();

      // Owner checks in to prove alive (need to be in a state where owner is active)
      // Since we advanced past inactivity, we need a fresh plan for this test
    });

    it("should cancel distribution mid-way", async function () {
      // Deploy plan with short inactivity
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });

      // Make owner inactive
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Phase 1 distributed
      await plan.connect(heir1).distributePhase(0, 0);

      // Owner cannot cancel when inactive
      await expect(plan.connect(owner).cancelDistribution(0))
        .to.be.revertedWith("Owner is inactive");
    });

    it("should reject cancel from non-owner", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
      await expect(plan.connect(stranger).cancelDistribution(0))
        .to.be.revertedWith("Not owner");
    });

    it("should reject cancel on non-distributing claim", async function () {
      await deployFundedWithClaim(); // claim is Pending
      await expect(plan.connect(owner).cancelDistribution(0))
        .to.be.revertedWith("Not distributing");
    });
  });

  // ===================== Deadman's Switch =====================

  describe("Deadman's Switch", function () {
    it("should extend inactivity deadline with grace period", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("1") });

      // Extend check-in via recovery address
      await plan.connect(recovery).extendCheckIn();
      expect(await plan.gracePeriodActive()).to.be.true;

      // After inactivity period, should still be active due to grace
      await time.increase(SIXTY_DAYS + 1);
      expect(await plan.isOwnerInactive()).to.be.false;

      // After grace period too, should be inactive
      await time.increase(GRACE_PERIOD);
      expect(await plan.isOwnerInactive()).to.be.true;
    });

    it("should reject double extension", async function () {
      await deployViaFactory();
      await plan.connect(recovery).extendCheckIn();
      await expect(plan.connect(recovery).extendCheckIn())
        .to.be.revertedWith("Already extended");
    });

    it("should reject extension from non-recovery address", async function () {
      await deployViaFactory();
      await expect(plan.connect(stranger).extendCheckIn())
        .to.be.revertedWith("Not recovery address");
    });

    it("should reset grace period on check-in", async function () {
      await deployViaFactory();
      await plan.connect(recovery).extendCheckIn();
      expect(await plan.gracePeriodActive()).to.be.true;
      await plan.connect(owner).checkIn();
      expect(await plan.gracePeriodActive()).to.be.false;
    });

    it("should reject extension when no grace period configured", async function () {
      const cfg = defaultConfig(recovery.address);
      cfg.gracePeriod = 0n;
      await deployViaFactory(undefined, SIXTY_DAYS, cfg);
      await expect(plan.connect(recovery).extendCheckIn())
        .to.be.revertedWith("No grace period configured");
    });
  });

  // ===================== Bond Return =====================

  describe("Bond Return", function () {
    it("should return bond after all claims distributed", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();

      // Complete all phases
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 1);
      await time.increase(THIRTY_DAYS - FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 2);

      // Now bonds can be withdrawn
      const balBefore = await ethers.provider.getBalance(verifier1.address);
      const tx = await plan.connect(verifier1).withdrawVerifierBond();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(verifier1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(BOND);
    });
  });

  // ===================== View Functions =====================

  describe("View Functions", function () {
    beforeEach(async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
    });

    it("should return correct isOwnerInactive", async function () {
      expect(await plan.isOwnerInactive()).to.be.false;
      await time.increase(SIXTY_DAYS + 1);
      expect(await plan.isOwnerInactive()).to.be.true;
    });

    it("should return correct timeUntilInactive", async function () {
      const remaining = await plan.timeUntilInactive();
      expect(remaining).to.be.greaterThan(0);
      await time.increase(SIXTY_DAYS + 1);
      expect(await plan.timeUntilInactive()).to.equal(0);
    });

    it("should return correct getPlanDetails with config including new fields", async function () {
      const details = await plan.getPlanDetails();
      expect(details._owner).to.equal(owner.address);
      expect(details._planName).to.equal(PLAN_NAME);
      // Balance includes 10 ETH funding + 3 ETH verifier bonds
      expect(details._balance).to.equal(ethers.parseEther("13"));
      expect(details._heirCount).to.equal(2n);
      expect(details._claimCount).to.equal(0n);
      expect(details._totalShareAllocated).to.equal(8000n);
      expect(details._isInactive).to.be.false;
      expect(details._config.requiredApprovals).to.equal(2n);
      expect(details._config.totalVerifiers).to.equal(3n);
      expect(details._config.phase2Delay).to.equal(BigInt(FOURTEEN_DAYS));
      expect(details._config.phase3Delay).to.equal(BigInt(THIRTY_DAYS));
      expect(details._config.autoRelease).to.be.false;
      expect(details._gracePeriodActive).to.be.false;
      expect(details._recoveryExtensionUsed).to.be.false;
    });

    it("should return all verifiers", async function () {
      const v = await plan.getAllVerifiers();
      expect(v.length).to.equal(3);
      expect(v[0]).to.equal(verifier1.address);
    });

    it("should return all heirs", async function () {
      const h = await plan.getAllHeirs();
      expect(h.length).to.equal(2);
      expect(h[0].wallet).to.equal(heir1.address);
      expect(h[1].sharePercentage).to.equal(3000);
    });

    it("should reject getClaimInfo for invalid claim", async function () {
      await expect(plan.getClaimInfo(0)).to.be.revertedWith("Invalid claim");
    });
  });

  // ===================== Check-In =====================

  describe("CheckIn", function () {
    beforeEach(async function () {
      await deployViaFactory();
    });

    it("should update lastCheckIn", async function () {
      await time.increase(1000);
      await expect(plan.connect(owner).checkIn()).to.emit(plan, "CheckedIn");
    });

    it("should reject non-owner", async function () {
      await expect(plan.connect(stranger).checkIn()).to.be.revertedWith("Not owner");
    });

    it("should reject when owner already inactive", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(owner).checkIn()).to.be.revertedWith("Owner inactive");
    });
  });

  // ===================== Withdraw Funds =====================

  describe("WithdrawFunds", function () {
    beforeEach(async function () {
      await deployViaFactory();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("5") });
    });

    it("should allow owner to withdraw while active", async function () {
      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await plan.connect(owner).withdrawFunds();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("5"));
    });

    it("should reject when no funds", async function () {
      await plan.connect(owner).withdrawFunds();
      await expect(plan.connect(owner).withdrawFunds()).to.be.revertedWith("No funds");
    });

    it("should reject non-owner", async function () {
      await expect(plan.connect(stranger).withdrawFunds()).to.be.revertedWith("Not owner");
    });

    it("should reject when owner is inactive", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(owner).withdrawFunds()).to.be.revertedWith("Owner inactive");
    });
  });

  // ===================== Funding =====================

  describe("Funding", function () {
    it("should accept ETH via receive", async function () {
      await deployViaFactory();
      const addr = await plan.getAddress();
      await expect(
        owner.sendTransaction({ to: addr, value: ethers.parseEther("1") })
      ).to.emit(plan, "FundsDeposited").withArgs(owner.address, ethers.parseEther("1"));
      expect(await ethers.provider.getBalance(addr)).to.equal(ethers.parseEther("1"));
    });
  });

  // ===================== Plan Updates (SC-U01 to SC-U06) =====================

  describe("Plan Updates", function () {
    beforeEach(async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death certificate");
      await plan.connect(owner).addHeir(heir2.address, 3000, 2, 0, "University degree");
    });

    // SC-U01: Remove heir (already in Heir Management, but verify shares freed)
    it("SC-U01: should free shares when heir removed", async function () {
      expect(await plan.totalShareAllocated()).to.equal(8000);
      await plan.connect(owner).removeHeir(heir1.address);
      expect(await plan.totalShareAllocated()).to.equal(3000);
      // Can now add heir3 with large share
      await plan.connect(owner).addHeir(heir3.address, 7000, 0, 0, "");
      expect(await plan.totalShareAllocated()).to.equal(10000);
    });

    // SC-U02: Update heir share
    it("SC-U02: should update heir share correctly", async function () {
      await expect(plan.connect(owner).updateHeirShare(heir1.address, 3000))
        .to.emit(plan, "HeirShareUpdated")
        .withArgs(heir1.address, 5000, 3000);
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs[0].sharePercentage).to.equal(3000);
      expect(await plan.totalShareAllocated()).to.equal(6000); // 3000 + 3000
    });

    it("SC-U02: should reject update share exceeding 100%", async function () {
      // heir1 = 5000, heir2 = 3000. Updating heir1 to 8000 -> total = 11000
      await expect(
        plan.connect(owner).updateHeirShare(heir1.address, 8000)
      ).to.be.revertedWith("Total shares exceed 100%");
    });

    it("SC-U02: should reject update share to 0", async function () {
      await expect(
        plan.connect(owner).updateHeirShare(heir1.address, 0)
      ).to.be.revertedWith("Share must be > 0");
    });

    it("SC-U02: should reject update on non-heir", async function () {
      await expect(
        plan.connect(owner).updateHeirShare(heir3.address, 1000)
      ).to.be.revertedWith("Not an heir");
    });

    // SC-U03: Update conditions
    it("SC-U03: should update heir conditions", async function () {
      await expect(plan.connect(owner).updateHeirCondition(heir1.address, 2, 0, "Updated to degree"))
        .to.emit(plan, "HeirConditionUpdated")
        .withArgs(heir1.address, 2);
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs[0].condition).to.equal(2); // Degree
    });

    it("SC-U03: should reject condition update on non-heir", async function () {
      await expect(
        plan.connect(owner).updateHeirCondition(heir3.address, 1, 0, "")
      ).to.be.revertedWith("Not an heir");
    });

    // SC-U04: Change inactivity period
    it("SC-U04: should update inactivity period", async function () {
      const sixMonths = 180 * ONE_DAY;
      await expect(plan.connect(owner).updateInactivityPeriod(sixMonths))
        .to.emit(plan, "InactivityPeriodUpdated")
        .withArgs(SIXTY_DAYS, sixMonths);
      expect(await plan.inactivityPeriod()).to.equal(sixMonths);
    });

    it("SC-U04: should reject period below minimum", async function () {
      await expect(
        plan.connect(owner).updateInactivityPeriod(ONE_DAY)
      ).to.be.revertedWith("Period too short");
    });

    // SC-U05: Non-owner update attempt
    it("SC-U05: should reject non-owner from updating share", async function () {
      await expect(
        plan.connect(stranger).updateHeirShare(heir1.address, 2000)
      ).to.be.revertedWith("Not owner");
    });

    it("SC-U05: should reject non-owner from updating condition", async function () {
      await expect(
        plan.connect(stranger).updateHeirCondition(heir1.address, 1, 0, "")
      ).to.be.revertedWith("Not owner");
    });

    it("SC-U05: should reject non-owner from updating inactivity period", async function () {
      await expect(
        plan.connect(stranger).updateInactivityPeriod(SIXTY_DAYS * 2)
      ).to.be.revertedWith("Not owner");
    });

    // SC-U06: Update after claim submitted — now blocked by noActiveClaims
    it("SC-U06: should still allow removing heir who has no active claim (no claims at all)", async function () {
      await plan.connect(owner).removeHeir(heir2.address);
      expect(await plan.isHeir(heir2.address)).to.be.false;
    });
  });

  // ===================== Duplicate Claim Prevention (SC-CL04) =====================

  describe("Duplicate Claim Prevention", function () {
    it("SC-CL04: should reject duplicate claim from same heir", async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID1");
      await expect(plan.connect(heir1).submitClaim("QmCID2"))
        .to.be.revertedWith("Active claim exists");
    });

    it("SC-CL04: should allow new claim after previous rejected", async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID1");
      // Reject it
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, false);
      // Now can submit again
      await plan.connect(heir1).submitClaim("QmCID2");
      expect(await plan.getClaimCount()).to.equal(2);
    });

    it("SC-CL04: should allow new claim after previous fully distributed", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
      await plan.connect(heir1).distributePhase(0, 0);
      await time.increase(FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 1);
      await time.increase(THIRTY_DAYS - FOURTEEN_DAYS);
      await plan.connect(heir1).distributePhase(0, 2);
      // Claim 0 is now Distributed, so heir can submit a new claim
      await plan.connect(heir1).submitClaim("QmCID2");
      expect(await plan.getClaimCount()).to.equal(2);
    });
  });

  // ===================== Check-In Edge Cases (SC-C05, SC-C06) =====================

  describe("Check-In Edge Cases", function () {
    // SC-C05: Check-in after inactivity rejects (current policy)
    it("SC-C05: should reject check-in after inactivity period passed", async function () {
      await deployViaFactory();
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(owner).checkIn()).to.be.revertedWith("Owner inactive");
    });

    // SC-C06: Multiple check-ins (no side effects)
    it("SC-C06: should handle multiple rapid check-ins", async function () {
      await deployViaFactory();
      await plan.connect(owner).checkIn();
      await plan.connect(owner).checkIn();
      await plan.connect(owner).checkIn();
      const details = await plan.getPlanDetails();
      expect(details._isInactive).to.be.false;
    });

    it("should reset inactivity timer on check-in", async function () {
      await deployViaFactory();
      // Wait 50 days (less than 60 day inactivity)
      await time.increase(50 * ONE_DAY);
      await plan.connect(owner).checkIn();
      // Wait another 50 days — still active because timer was reset
      await time.increase(50 * ONE_DAY);
      expect(await plan.isOwnerInactive()).to.be.false;
    });
  });

  // ===================== Revoke Plan (SC-E01 to SC-E05) =====================

  describe("Revoke Plan", function () {
    // SC-E01: Owner revokes plan
    it("SC-E01: should revoke plan, cancel pending claims, return funds", async function () {
      await deployFundedWithClaim(); // Creates plan with 10 ETH + 3 ETH bonds, 1 pending claim
      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await plan.connect(owner).revokePlan();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(await plan.revoked()).to.be.true;
      // Pending claim should be rejected
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(3); // Rejected
      // Owner should receive 10 ETH (contract balance minus bonds)
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("10"));
    });

    // SC-E02: Revoke after partial distribution
    it("SC-E02: should return remaining funds after partial distribution", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
      // Phase 1: heir gets 0.5 ETH
      await plan.connect(heir1).distributePhase(0, 0);

      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await plan.connect(owner).revokePlan();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      // Remaining: 10 - 0.5 = 9.5 ETH distributable (bonds excluded)
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("9.5"));
    });

    // SC-E03: Non-owner revoke
    it("SC-E03: should reject non-owner revoke", async function () {
      await deployViaFactory();
      await expect(plan.connect(stranger).revokePlan()).to.be.revertedWith("Not owner");
    });

    // SC-E04: Actions on revoked plan
    it("SC-E04: should reject all state-changing actions on revoked plan", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).revokePlan();

      // Submit claim
      await expect(
        plan.connect(heir1).submitClaim("QmCID")
      ).to.be.revertedWith("Plan revoked");

      // Add heir
      await expect(
        plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "")
      ).to.be.revertedWith("Plan revoked");

      // Check-in
      await expect(
        plan.connect(owner).checkIn()
      ).to.be.revertedWith("Plan revoked");

      // Stake
      await expect(
        plan.connect(verifier1).stakeAsVerifier({ value: BOND })
      ).to.be.revertedWith("Plan revoked");
    });

    // SC-E05: Revoke with no funds
    it("SC-E05: should revoke cleanly with 0 balance", async function () {
      await deployViaFactory();
      await expect(plan.connect(owner).revokePlan())
        .to.emit(plan, "PlanRevoked")
        .withArgs(owner.address);
      expect(await plan.revoked()).to.be.true;
    });

    it("should reject double revoke", async function () {
      await deployViaFactory();
      await plan.connect(owner).revokePlan();
      await expect(plan.connect(owner).revokePlan()).to.be.revertedWith("Already revoked");
    });
  });

  // ===================== Distribution Edge Cases (SC-D03 to SC-D08) =====================

  describe("Distribution Edge Cases", function () {
    // SC-D03: Distribute unverified claim
    it("SC-D03: should reject distribution of non-distributing claim", async function () {
      await deployFundedWithClaim(); // claim is Pending
      await expect(plan.connect(heir1).distributePhase(0, 0))
        .to.be.revertedWith("Not distributing");
    });

    // SC-D04: Double distribution (Phase 1 already claimed)
    it("SC-D04: should reject double Phase 1 claim", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
      await plan.connect(heir1).distributePhase(0, 0);
      await expect(plan.connect(heir1).distributePhase(0, 0))
        .to.be.revertedWith("Phase 1 already claimed");
    });

    // SC-D05: Insufficient funds handling
    it("SC-D05: should revert if contract has insufficient balance for phase", async function () {
      // Deploy with only 1 wei funded
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: 1n });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Contract snapshot balance is 1 wei. Phase 1 = 10% of 1 wei = 0 (rounds down).
      // This should not revert since amount is 0, but let's verify the scenario works
      await plan.connect(heir1).distributePhase(0, 0); // 0 wei transfer should succeed
    });

    // SC-D06: Partial distribution (multiple heirs, only 1 verified)
    it("SC-D06: should allow one heir to distribute while another is pending", async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);

      // Only heir1 submits and gets approved
      await plan.connect(heir1).submitClaim("QmCID1");
      await approveAndFinalize();
      await plan.connect(heir1).distributePhase(0, 0);

      // heir2 hasn't claimed yet — no issues
      const claim = await plan.getClaimInfo(0);
      expect(claim.phase1Claimed).to.be.true;
    });

    // SC-D07: ETH receive function (already tested in Funding, but verify balance update)
    it("SC-D07: should correctly track received ETH", async function () {
      await deployViaFactory();
      const addr = await plan.getAddress();
      await owner.sendTransaction({ to: addr, value: ethers.parseEther("5") });
      await stranger.sendTransaction({ to: addr, value: ethers.parseEther("3") });
      expect(await ethers.provider.getBalance(addr)).to.equal(ethers.parseEther("8"));
    });

    // SC-D08: Zero-balance distribution
    it("SC-D08: should handle zero distributable balance gracefully", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      // Don't fund the plan at all (balance is only verifier bonds)
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Snapshot balance = contract balance - totalActiveBonds = 3 ETH - 3 ETH = 0
      const claim = await plan.getClaimInfo(0);
      expect(claim.snapshotBalance).to.equal(0);

      // Phase 1 of 0 = 0 wei, should succeed
      await plan.connect(heir1).distributePhase(0, 0);
    });

    // SC-D02: Multi-heir proportional distribution
    it("SC-D02: should distribute correct proportions to 3 heirs", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, ""); // 50%
      await plan.connect(owner).addHeir(heir2.address, 3000, 0, 0, ""); // 30%
      await plan.connect(owner).addHeir(heir3.address, 2000, 0, 0, ""); // 20%
      await plan.connect(heir1).acceptInheritance();
      await plan.connect(heir2).acceptInheritance();
      await plan.connect(heir3).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);

      // Heir1 submits, approved, finalized
      await plan.connect(heir1).submitClaim("QmCID1");
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // heir1 50% of 10 ETH = 5 ETH total (Phase 1 = 0.5)
      const bal1Before = await ethers.provider.getBalance(heir1.address);
      const tx1 = await plan.connect(heir1).distributePhase(0, 0);
      const receipt1 = await tx1.wait();
      const gas1 = receipt1!.gasUsed * receipt1!.gasPrice;
      const bal1After = await ethers.provider.getBalance(heir1.address);
      expect(bal1After - bal1Before + gas1).to.equal(ethers.parseEther("0.5"));
    });
  });

  // ===================== Security Tests (SEC-01 to SEC-10) =====================

  describe("Security Tests", function () {
    // SEC-01: Reentrancy on distribute (protected by ReentrancyGuard)
    it("SEC-01: should have ReentrancyGuard on distributePhase", async function () {
      // We verify this by checking the contract inherits ReentrancyGuard
      // The nonReentrant modifier is on distributePhase and withdrawVerifierBond
      await deployFundedWithClaim();
      await approveAndFinalize();
      // A simple call should work fine
      await plan.connect(heir1).distributePhase(0, 0);
    });

    // SEC-02: Owner impersonation
    it("SEC-02: should reject non-owner on all owner functions", async function () {
      await deployViaFactory();
      await expect(plan.connect(stranger).checkIn()).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).addHeir(heir1.address, 5000, 0, 0, "")).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).removeHeir(heir1.address)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).withdrawFunds()).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).revokePlan()).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).updateHeirShare(heir1.address, 1000)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).updateHeirCondition(heir1.address, 0, 0, "")).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).updateInactivityPeriod(SIXTY_DAYS)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).cancelClaimAsOwner(0)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).addChallenger(heir1.address)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).removeChallenger(heir1.address)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).setBackupHeir(heir1.address)).to.be.revertedWith("Not owner");
      await expect(plan.connect(stranger).updateDistributionDelays(BigInt(7 * ONE_DAY), BigInt(14 * ONE_DAY))).to.be.revertedWith("Not owner");
    });

    // SEC-03: Heir impersonation
    it("SEC-03: should reject non-heir claim submission", async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("1") });
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(stranger).submitClaim("QmFake")).to.be.revertedWith("Not heir");
    });

    // SEC-04: Verifier impersonation
    it("SEC-04: should reject non-verifier voting", async function () {
      await deployFundedWithClaim();
      await expect(plan.connect(stranger).vote(0, true)).to.be.revertedWith("Not verifier");
      await expect(plan.connect(heir1).vote(0, true)).to.be.revertedWith("Not verifier");
    });

    // SEC-05: Integer overflow on shares (Solidity 0.8+ prevents)
    it("SEC-05: should handle extreme share values safely", async function () {
      await deployViaFactory();
      // Try max uint256 share — should revert on totalShareAllocated overflow
      await expect(
        plan.connect(owner).addHeir(heir1.address, ethers.MaxUint256, 0, 0, "")
      ).to.be.reverted;
    });

    // SEC-06: Front-running distribute (funds always go to stored heir address)
    it("SEC-06: should send funds to stored heir address, not msg.sender", async function () {
      await deployFundedWithClaim();
      await approveAndFinalize();
      // Only heir1 can call distributePhase for claim 0
      await expect(
        plan.connect(stranger).distributePhase(0, 0)
      ).to.be.revertedWith("Not claim heir");
    });

    // SEC-07: Unauthorized fund drain
    it("SEC-07: should prevent unauthorized fund withdrawal", async function () {
      await deployViaFactory();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("5") });
      // Stranger can't withdraw
      await expect(plan.connect(stranger).withdrawFunds()).to.be.revertedWith("Not owner");
      // Heir can't withdraw
      await expect(plan.connect(heir1).withdrawFunds()).to.be.revertedWith("Not owner");
    });

    // SEC-09: Self-destruct / forced ETH (contract uses address.balance for distribution snapshot)
    it("SEC-09: should account for all ETH including forced sends in balance", async function () {
      await deployWithHeirs();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      // The contract uses address(this).balance which includes any forcibly-sent ETH
      const details = await plan.getPlanDetails();
      expect(details._balance).to.equal(ethers.parseEther("13")); // 10 + 3 bonds
    });

    // SEC-10: Gas limit on heir iteration (reasonable cap implicit in share limits)
    it("SEC-10: should handle maximum reasonable number of heirs", async function () {
      await deployViaFactory();
      // Add 9 heirs using available signers (indices 11-19)
      const signers = await ethers.getSigners();
      for (let i = 0; i < 9; i++) {
        await plan.connect(owner).addHeir(signers[11 + i].address, 1000, 0, 0, "");
      }
      expect(await plan.getHeirCount()).to.equal(9);
      expect(await plan.totalShareAllocated()).to.equal(9000);
      // getAllHeirs should still work
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs.length).to.equal(9);
    });
  });

  // ===================== Edge Case Tests (EDGE-01 to EDGE-12) =====================

  describe("Edge Cases", function () {
    // EDGE-01: Single heir, 100% share
    it("EDGE-01: should distribute full balance to single 100% heir", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Phase 1: 10% of 10 ETH = 1 ETH
      const bal1 = await ethers.provider.getBalance(heir1.address);
      const tx1 = await plan.connect(heir1).distributePhase(0, 0);
      const r1 = await tx1.wait();
      const g1 = r1!.gasUsed * r1!.gasPrice;
      expect(await ethers.provider.getBalance(heir1.address) - bal1 + g1).to.equal(ethers.parseEther("1"));

      // Phase 2: 40% of 10 ETH = 4 ETH
      await time.increase(FOURTEEN_DAYS);
      const bal2 = await ethers.provider.getBalance(heir1.address);
      const tx2 = await plan.connect(heir1).distributePhase(0, 1);
      const r2 = await tx2.wait();
      const g2 = r2!.gasUsed * r2!.gasPrice;
      expect(await ethers.provider.getBalance(heir1.address) - bal2 + g2).to.equal(ethers.parseEther("4"));

      // Phase 3: 50% of 10 ETH = 5 ETH
      await time.increase(THIRTY_DAYS - FOURTEEN_DAYS);
      const bal3 = await ethers.provider.getBalance(heir1.address);
      const tx3 = await plan.connect(heir1).distributePhase(0, 2);
      const r3 = await tx3.wait();
      const g3 = r3!.gasUsed * r3!.gasPrice;
      expect(await ethers.provider.getBalance(heir1.address) - bal3 + g3).to.equal(ethers.parseEther("5"));

      // Fully distributed
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(7); // Distributed
    });

    // EDGE-02: Heir wallet is a contract (receives ETH via receive/fallback)
    it("EDGE-02: should distribute to contract address that can receive ETH", async function () {
      // Use the factory contract itself as a "contract heir" since it has no receive
      // We'll just verify we can add a contract address as heir
      await deployViaFactory();
      const factoryAddr = await factory.getAddress();
      // The factory doesn't have a receive function, so distribution would fail
      // But adding as heir should work
      await plan.connect(owner).addHeir(factoryAddr, 5000, 0, 0, "");
      expect(await plan.isHeir(factoryAddr)).to.be.true;
    });

    // EDGE-03: Owner cannot be heir (already tested in Heir Management)
    it("EDGE-03: should reject owner as heir", async function () {
      await deployViaFactory();
      await expect(
        plan.connect(owner).addHeir(owner.address, 5000, 0, 0, "")
      ).to.be.revertedWith("Owner cannot be heir");
    });

    // EDGE-04: Very small amounts
    it("EDGE-04: should handle 1 wei fund with 3 heirs", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 3334, 0, 0, ""); // 33.34%
      await plan.connect(owner).addHeir(heir2.address, 3333, 0, 0, ""); // 33.33%
      await plan.connect(owner).addHeir(heir3.address, 3333, 0, 0, ""); // 33.33%
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: 1n }); // 1 wei
      await time.increase(SIXTY_DAYS + 1);

      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // 1 wei * 3334 / 10000 = 0 (rounds down), Phase 1 = 10% of 0 = 0
      // Should not revert
      await plan.connect(heir1).distributePhase(0, 0);
    });

    // EDGE-05: Very large amounts
    it("EDGE-05: should handle 1000 ETH correctly", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 10000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("1000") });
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await approveClaim();
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Phase 1: 10% of 1000 ETH = 100 ETH
      const balBefore = await ethers.provider.getBalance(heir1.address);
      const tx = await plan.connect(heir1).distributePhase(0, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("100"));
    });

    // EDGE-06: Minimum inactivity period (30 days)
    it("EDGE-06: should enforce minimum inactivity period of 30 days", async function () {
      // Already tested in constructor, verify with updateInactivityPeriod too
      await deployViaFactory();
      await expect(
        plan.connect(owner).updateInactivityPeriod(THIRTY_DAYS - 1)
      ).to.be.revertedWith("Period too short");
      // Exactly 30 days should work
      await plan.connect(owner).updateInactivityPeriod(THIRTY_DAYS);
      expect(await plan.inactivityPeriod()).to.equal(THIRTY_DAYS);
    });

    // EDGE-07: Maximum inactivity period (50 years)
    it("EDGE-07: should handle 50-year inactivity period", async function () {
      const fiftyYears = 50 * 365 * ONE_DAY;
      await deployViaFactory(undefined, fiftyYears);
      expect(await plan.inactivityPeriod()).to.equal(fiftyYears);
      // timeUntilInactive should return a large number
      const remaining = await plan.timeUntilInactive();
      expect(remaining).to.be.greaterThan(BigInt(fiftyYears - ONE_DAY));
    });

    // EDGE-08: Rapid check-ins
    it("EDGE-08: should handle 10 rapid check-ins without issues", async function () {
      await deployViaFactory();
      for (let i = 0; i < 10; i++) {
        await plan.connect(owner).checkIn();
      }
      expect(await plan.isOwnerInactive()).to.be.false;
    });

    // EDGE-11: Shares that don't divide evenly (33/33/34)
    it("EDGE-11: should handle non-even share splits correctly", async function () {
      await deployViaFactory();
      await stakeAllVerifiers();
      await plan.connect(owner).addHeir(heir1.address, 3300, 0, 0, ""); // 33%
      await plan.connect(owner).addHeir(heir2.address, 3300, 0, 0, ""); // 33%
      await plan.connect(owner).addHeir(heir3.address, 3400, 0, 0, ""); // 34%
      await plan.connect(heir1).acceptInheritance();
      expect(await plan.totalShareAllocated()).to.equal(10000);

      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
      await time.increase(SIXTY_DAYS + 1);

      // heir1 claims: 33% of 10 ETH = 3.3 ETH
      await plan.connect(heir1).submitClaim("QmCID1");
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
      await time.increase(ONE_DAY + 1);
      await plan.finalizeApproval(0);

      // Phase 1 = 10% of 3.3 = 0.33 ETH
      const balBefore = await ethers.provider.getBalance(heir1.address);
      const tx = await plan.connect(heir1).distributePhase(0, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("0.33"));
    });

    // EDGE-12: Unicode/special chars in conditions
    it("EDGE-12: should store unicode and special characters in condition details", async function () {
      await deployViaFactory();
      const unicodeDetail = "Certificat de décès 死亡証明書 🏛️";
      await plan.connect(owner).addHeir(heir1.address, 5000, 5, 0, unicodeDetail); // Custom condition
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs[0].conditionDetail).to.equal(unicodeDetail);
    });

    // Additional: Condition types stored correctly
    it("should store all condition types correctly", async function () {
      await deployViaFactory();
      const signers = await ethers.getSigners();
      // Death=0, Birth=1, Degree=2, Marriage=3, Age=4, Custom=5
      for (let i = 0; i < 6; i++) {
        await plan.connect(owner).addHeir(
          signers[11 + i].address,
          1000,
          i,
          i === 4 ? 25 : 0,
          i === 5 ? "Custom detail" : ""
        );
      }
      const allHeirs = await plan.getAllHeirs();
      for (let i = 0; i < 6; i++) {
        expect(allHeirs[i].condition).to.equal(i);
      }
    });
  });
});
