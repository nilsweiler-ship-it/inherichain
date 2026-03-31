import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { InheritancePlan, InheriChainFactory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";

describe("InheritancePlan", function () {
  let plan: InheritancePlan;
  let owner: HardhatEthersSigner;
  let verifier1: HardhatEthersSigner;
  let verifier2: HardhatEthersSigner;
  let verifier3: HardhatEthersSigner;
  let heir1: HardhatEthersSigner;
  let heir2: HardhatEthersSigner;
  let heir3: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const PLAN_NAME = "My Inheritance Plan";
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  const SIXTY_DAYS = 60 * 24 * 60 * 60;

  async function deployPlan(inactivityPeriod = SIXTY_DAYS) {
    const factory = await ethers.getContractFactory("InheritancePlan");
    const verifiers: [string, string, string] = [
      verifier1.address,
      verifier2.address,
      verifier3.address,
    ];
    plan = await factory.deploy(owner.address, PLAN_NAME, verifiers, inactivityPeriod);
    return plan;
  }

  async function deployWithHeirs() {
    await deployPlan();
    await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death certificate");
    await plan.connect(owner).addHeir(heir2.address, 3000, 4, 25, "Age verification");
    return plan;
  }

  async function deployFundedWithClaim() {
    await deployWithHeirs();
    await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("10") });
    await time.increase(SIXTY_DAYS + 1);
    await plan.connect(heir1).submitClaim("QmTestCID123");
    return plan;
  }

  beforeEach(async function () {
    [owner, verifier1, verifier2, verifier3, heir1, heir2, heir3, stranger] =
      await ethers.getSigners();
  });

  describe("Constructor", function () {
    it("should set correct initial values", async function () {
      await deployPlan();
      expect(await plan.owner()).to.equal(owner.address);
      expect(await plan.planName()).to.equal(PLAN_NAME);
      expect(await plan.verifiers(0)).to.equal(verifier1.address);
      expect(await plan.verifiers(1)).to.equal(verifier2.address);
      expect(await plan.verifiers(2)).to.equal(verifier3.address);
      expect(await plan.inactivityPeriod()).to.equal(SIXTY_DAYS);
    });

    it("should reject zero address owner", async function () {
      const factory = await ethers.getContractFactory("InheritancePlan");
      await expect(
        factory.deploy(ethers.ZeroAddress, PLAN_NAME, [verifier1.address, verifier2.address, verifier3.address], SIXTY_DAYS)
      ).to.be.revertedWith("Invalid owner");
    });

    it("should reject inactivity period less than 30 days", async function () {
      const factory = await ethers.getContractFactory("InheritancePlan");
      await expect(
        factory.deploy(owner.address, PLAN_NAME, [verifier1.address, verifier2.address, verifier3.address], THIRTY_DAYS - 1)
      ).to.be.revertedWith("Period too short");
    });

    it("should accept exactly 30 days inactivity period", async function () {
      const factory = await ethers.getContractFactory("InheritancePlan");
      const p = await factory.deploy(owner.address, PLAN_NAME, [verifier1.address, verifier2.address, verifier3.address], THIRTY_DAYS);
      expect(await p.inactivityPeriod()).to.equal(THIRTY_DAYS);
    });

    it("should reject zero address verifiers", async function () {
      const factory = await ethers.getContractFactory("InheritancePlan");
      await expect(
        factory.deploy(owner.address, PLAN_NAME, [ethers.ZeroAddress, verifier2.address, verifier3.address], SIXTY_DAYS)
      ).to.be.revertedWith("Invalid verifier");
    });

    it("should reject duplicate verifiers", async function () {
      const factory = await ethers.getContractFactory("InheritancePlan");
      await expect(
        factory.deploy(owner.address, PLAN_NAME, [verifier1.address, verifier1.address, verifier3.address], SIXTY_DAYS)
      ).to.be.revertedWith("Duplicate verifiers");
    });

    it("should reject owner as verifier", async function () {
      const factory = await ethers.getContractFactory("InheritancePlan");
      await expect(
        factory.deploy(owner.address, PLAN_NAME, [owner.address, verifier2.address, verifier3.address], SIXTY_DAYS)
      ).to.be.revertedWith("Owner cannot be verifier");
    });
  });

  describe("Funding", function () {
    it("should accept ETH via receive", async function () {
      await deployPlan();
      const addr = await plan.getAddress();
      await expect(
        owner.sendTransaction({ to: addr, value: ethers.parseEther("1") })
      ).to.emit(plan, "FundsDeposited").withArgs(owner.address, ethers.parseEther("1"));
      expect(await ethers.provider.getBalance(addr)).to.equal(ethers.parseEther("1"));
    });
  });

  describe("AddHeir", function () {
    beforeEach(async function () {
      await deployPlan();
    });

    it("should add an heir correctly", async function () {
      await expect(plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "Death cert"))
        .to.emit(plan, "HeirAdded")
        .withArgs(heir1.address, 5000, 0);
      expect(await plan.isHeir(heir1.address)).to.be.true;
      expect(await plan.getHeirCount()).to.equal(1);
      expect(await plan.totalShareAllocated()).to.equal(5000);
    });

    it("should add multiple heirs", async function () {
      await plan.connect(owner).addHeir(heir1.address, 3000, 0, 0, "");
      await plan.connect(owner).addHeir(heir2.address, 4000, 1, 0, "");
      await plan.connect(owner).addHeir(heir3.address, 3000, 2, 0, "");
      expect(await plan.getHeirCount()).to.equal(3);
      expect(await plan.totalShareAllocated()).to.equal(10000);
    });

    it("should reject non-owner adding heir", async function () {
      await expect(
        plan.connect(stranger).addHeir(heir1.address, 5000, 0, 0, "")
      ).to.be.revertedWith("Not owner");
    });

    it("should reject zero address heir", async function () {
      await expect(
        plan.connect(owner).addHeir(ethers.ZeroAddress, 5000, 0, 0, "")
      ).to.be.revertedWith("Invalid heir address");
    });

    it("should reject duplicate heir", async function () {
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await expect(
        plan.connect(owner).addHeir(heir1.address, 3000, 0, 0, "")
      ).to.be.revertedWith("Already an heir");
    });

    it("should reject zero share", async function () {
      await expect(
        plan.connect(owner).addHeir(heir1.address, 0, 0, 0, "")
      ).to.be.revertedWith("Share must be > 0");
    });

    it("should reject shares exceeding 100%", async function () {
      await plan.connect(owner).addHeir(heir1.address, 8000, 0, 0, "");
      await expect(
        plan.connect(owner).addHeir(heir2.address, 3000, 0, 0, "")
      ).to.be.revertedWith("Total shares exceed 100%");
    });

    it("should reject owner as heir", async function () {
      await expect(
        plan.connect(owner).addHeir(owner.address, 5000, 0, 0, "")
      ).to.be.revertedWith("Owner cannot be heir");
    });

    it("should return all heirs via getAllHeirs", async function () {
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "death");
      await plan.connect(owner).addHeir(heir2.address, 3000, 4, 25, "age");
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs.length).to.equal(2);
      expect(allHeirs[0].wallet).to.equal(heir1.address);
      expect(allHeirs[1].sharePercentage).to.equal(3000);
    });
  });

  describe("RemoveHeir", function () {
    beforeEach(async function () {
      await deployWithHeirs();
    });

    it("should remove an heir", async function () {
      await expect(plan.connect(owner).removeHeir(heir1.address))
        .to.emit(plan, "HeirRemoved")
        .withArgs(heir1.address);
      expect(await plan.isHeir(heir1.address)).to.be.false;
      expect(await plan.getHeirCount()).to.equal(1);
      expect(await plan.totalShareAllocated()).to.equal(3000);
    });

    it("should correctly swap-remove when removing non-last heir", async function () {
      await plan.connect(owner).removeHeir(heir1.address);
      const allHeirs = await plan.getAllHeirs();
      expect(allHeirs.length).to.equal(1);
      expect(allHeirs[0].wallet).to.equal(heir2.address);
    });

    it("should reject removing non-heir", async function () {
      await expect(
        plan.connect(owner).removeHeir(stranger.address)
      ).to.be.revertedWith("Not an heir");
    });

    it("should reject non-owner removing heir", async function () {
      await expect(
        plan.connect(stranger).removeHeir(heir1.address)
      ).to.be.revertedWith("Not owner");
    });

    it("should allow re-adding a removed heir", async function () {
      await plan.connect(owner).removeHeir(heir1.address);
      await plan.connect(owner).addHeir(heir1.address, 2000, 0, 0, "new");
      expect(await plan.isHeir(heir1.address)).to.be.true;
      expect(await plan.totalShareAllocated()).to.equal(5000);
    });
  });

  describe("CheckIn", function () {
    beforeEach(async function () {
      await deployPlan();
    });

    it("should update lastCheckIn", async function () {
      await time.increase(1000);
      await expect(plan.connect(owner).checkIn()).to.emit(plan, "CheckedIn");
      const lastCheck = await plan.lastCheckIn();
      const blockTime = await time.latest();
      expect(lastCheck).to.equal(blockTime);
    });

    it("should reject non-owner", async function () {
      await expect(plan.connect(stranger).checkIn()).to.be.revertedWith("Not owner");
    });

    it("should reject when owner already inactive", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await expect(plan.connect(owner).checkIn()).to.be.revertedWith("Owner inactive");
    });
  });

  describe("WithdrawFunds", function () {
    beforeEach(async function () {
      await deployPlan();
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

    it("should emit FundsWithdrawn event", async function () {
      await expect(plan.connect(owner).withdrawFunds())
        .to.emit(plan, "FundsWithdrawn")
        .withArgs(owner.address, ethers.parseEther("5"));
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

  describe("SubmitClaim", function () {
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
      await expect(
        plan.connect(heir1).submitClaim("QmTestCID")
      ).to.be.revertedWith("Owner still active");
    });

    it("should reject claim from non-heir", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await expect(
        plan.connect(stranger).submitClaim("QmTestCID")
      ).to.be.revertedWith("Not heir");
    });

    it("should allow multiple claims from different heirs", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID1");
      await plan.connect(heir2).submitClaim("QmCID2");
      expect(await plan.getClaimCount()).to.equal(2);
    });

    it("should reject duplicate active claim from same heir", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID1");
      await expect(
        plan.connect(heir1).submitClaim("QmCID2")
      ).to.be.revertedWith("Active claim exists");
    });

    it("should allow re-claim after rejection", async function () {
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID1");
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, false);
      // After rejection, should be able to submit again
      await plan.connect(heir1).submitClaim("QmCID2");
      expect(await plan.getClaimCount()).to.equal(2);
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
    });
  });

  describe("Vote", function () {
    beforeEach(async function () {
      await deployFundedWithClaim();
    });

    it("should allow verifier to approve", async function () {
      await expect(plan.connect(verifier1).vote(0, true))
        .to.emit(plan, "ClaimVoted")
        .withArgs(0, verifier1.address, true);
      const claim = await plan.getClaimInfo(0);
      expect(claim.approvals).to.equal(1);
    });

    it("should allow verifier to reject", async function () {
      await expect(plan.connect(verifier1).vote(0, false))
        .to.emit(plan, "ClaimVoted")
        .withArgs(0, verifier1.address, false);
      const claim = await plan.getClaimInfo(0);
      expect(claim.rejections).to.equal(1);
    });

    it("should approve claim with 2 approvals", async function () {
      await plan.connect(verifier1).vote(0, true);
      await expect(plan.connect(verifier2).vote(0, true))
        .to.emit(plan, "ClaimApproved")
        .withArgs(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(2); // Approved
    });

    it("should reject claim with 2 rejections", async function () {
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

    it("should reject double vote", async function () {
      await plan.connect(verifier1).vote(0, true);
      await expect(plan.connect(verifier1).vote(0, true)).to.be.revertedWith("Already voted");
    });

    it("should reject vote on invalid claim", async function () {
      await expect(plan.connect(verifier1).vote(99, true)).to.be.revertedWith("Invalid claim");
    });

    it("should reject vote on non-pending claim", async function () {
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true); // Now approved
      await expect(plan.connect(verifier3).vote(0, true)).to.be.revertedWith("Claim not pending");
    });

    it("should handle mixed votes (1 approve, 2 reject)", async function () {
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, false);
      await plan.connect(verifier3).vote(0, false);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(3); // Rejected
    });

    it("should handle mixed votes (2 approve, 1 reject)", async function () {
      await plan.connect(verifier1).vote(0, false);
      await plan.connect(verifier2).vote(0, true);
      await plan.connect(verifier3).vote(0, true);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(2); // Approved
    });
  });

  describe("Distribute", function () {
    beforeEach(async function () {
      await deployFundedWithClaim();
      await plan.connect(verifier1).vote(0, true);
      await plan.connect(verifier2).vote(0, true);
    });

    it("should distribute correct amount to heir", async function () {
      const balBefore = await ethers.provider.getBalance(heir1.address);
      const tx = await plan.connect(heir1).distribute(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir1.address);
      // heir1 has 5000/10000 = 50% of 10 ETH = 5 ETH
      // But distributed from (10000 - 0) = 10000 basis points
      // amount = 10 * 5000 / 10000 = 5 ETH
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("5"));
    });

    it("should mark claim as distributed", async function () {
      await plan.connect(heir1).distribute(0);
      const claim = await plan.getClaimInfo(0);
      expect(claim.status).to.equal(4); // Distributed
    });

    it("should emit FundsDistributed event", async function () {
      await expect(plan.connect(heir1).distribute(0))
        .to.emit(plan, "FundsDistributed")
        .withArgs(0, heir1.address, ethers.parseEther("5"));
    });

    it("should reject distribute for non-approved claim", async function () {
      // Submit a new claim that hasn't been voted on
      await plan.connect(heir2).submitClaim("QmCID2");
      await expect(plan.connect(heir2).distribute(1)).to.be.revertedWith("Claim not approved");
    });

    it("should reject distribute from wrong heir", async function () {
      await expect(plan.connect(heir2).distribute(0)).to.be.revertedWith("Not claim heir");
    });

    it("should reject double distribute", async function () {
      await plan.connect(heir1).distribute(0);
      await expect(plan.connect(heir1).distribute(0)).to.be.revertedWith("Claim not approved");
    });

    it("should correctly distribute proportional amounts for multiple heirs", async function () {
      // heir1 distributes 50% (5 ETH), leaving 5 ETH
      await plan.connect(heir1).distribute(0);

      // heir2 submits and gets approved
      await plan.connect(heir2).submitClaim("QmCID2");
      await plan.connect(verifier1).vote(1, true);
      await plan.connect(verifier2).vote(1, true);

      // heir2 has 3000 basis points, distributedShare is now 5000
      // amount = 5 ETH * 3000 / (10000 - 5000) = 5 * 3000 / 5000 = 3 ETH
      const balBefore = await ethers.provider.getBalance(heir2.address);
      const tx = await plan.connect(heir2).distribute(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(heir2.address);
      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("3"));
    });
  });

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

    it("should return correct plan details", async function () {
      const details = await plan.getPlanDetails();
      expect(details._owner).to.equal(owner.address);
      expect(details._planName).to.equal(PLAN_NAME);
      expect(details._balance).to.equal(ethers.parseEther("10"));
      expect(details._heirCount).to.equal(2n);
      expect(details._claimCount).to.equal(0n);
      expect(details._totalShareAllocated).to.equal(8000n);
      expect(details._isInactive).to.be.false;
    });

    it("should reject getClaimInfo for invalid claim", async function () {
      await expect(plan.getClaimInfo(0)).to.be.revertedWith("Invalid claim");
    });
  });
});
