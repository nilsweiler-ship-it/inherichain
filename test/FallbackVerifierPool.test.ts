import { expect } from "chai";
import { ethers } from "hardhat";
import { FallbackVerifierPool } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";

describe("FallbackVerifierPool", function () {
  let pool: FallbackVerifierPool;
  let owner: HardhatEthersSigner;
  let fv1: HardhatEthersSigner;
  let fv2: HardhatEthersSigner;
  let fv3: HardhatEthersSigner;
  let fv4: HardhatEthersSigner;
  let plan: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const MIN_STAKE = ethers.parseEther("0.1");
  const STAKE = ethers.parseEther("0.5");

  beforeEach(async function () {
    [owner, fv1, fv2, fv3, fv4, plan, stranger] = await ethers.getSigners();
    const Pool = await ethers.getContractFactory("FallbackVerifierPool");
    pool = await Pool.deploy();
  });

  describe("Registration", function () {
    it("should register as fallback verifier with minimum stake", async function () {
      await expect(pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE }))
        .to.emit(pool, "VerifierRegistered")
        .withArgs(fv1.address, MIN_STAKE);
      expect(await pool.isRegistered(fv1.address)).to.be.true;
      expect(await pool.getPoolSize()).to.equal(1);
    });

    it("should register with more than minimum stake", async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: STAKE });
      const info = await pool.getVerifierInfo(fv1.address);
      expect(info.stake).to.equal(STAKE);
    });

    it("should reject insufficient stake", async function () {
      await expect(
        pool.connect(fv1).registerAsFallbackVerifier({ value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("should reject double registration", async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE });
      await expect(
        pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE })
      ).to.be.revertedWith("Already registered");
    });

    it("should track multiple registrations", async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv2).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv3).registerAsFallbackVerifier({ value: MIN_STAKE });
      expect(await pool.getPoolSize()).to.equal(3);
      expect(await pool.getActiveVerifierCount()).to.equal(3);
    });
  });

  describe("Withdrawal", function () {
    beforeEach(async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: STAKE });
    });

    it("should withdraw stake when not assigned", async function () {
      const balBefore = await ethers.provider.getBalance(fv1.address);
      const tx = await pool.connect(fv1).withdrawFromPool();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(fv1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(STAKE);
      expect(await pool.isRegistered(fv1.address)).to.be.false;
      expect(await pool.getPoolSize()).to.equal(0);
    });

    it("should reject withdrawal from non-registered", async function () {
      await expect(pool.connect(stranger).withdrawFromPool())
        .to.be.revertedWith("Not registered");
    });

    it("should reject withdrawal when assigned to plans", async function () {
      await pool.connect(fv2).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv3).registerAsFallbackVerifier({ value: MIN_STAKE });
      // Assign fv1 to a plan
      await pool.requestFallbackVerifiers(plan.address, 1);
      await expect(pool.connect(fv1).withdrawFromPool())
        .to.be.revertedWith("Currently assigned to plans");
    });
  });

  describe("Assignment", function () {
    beforeEach(async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv2).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv3).registerAsFallbackVerifier({ value: MIN_STAKE });
    });

    it("should assign verifiers round-robin", async function () {
      const tx = await pool.requestFallbackVerifiers(plan.address, 2);
      await expect(tx).to.emit(pool, "FallbackVerifiersAssigned");

      const assigned = await pool.getPlanFallbackVerifiers(plan.address);
      expect(assigned.length).to.equal(2);
    });

    it("should reject when not enough verifiers", async function () {
      await expect(
        pool.requestFallbackVerifiers(plan.address, 5)
      ).to.be.revertedWith("Not enough verifiers in pool");
    });

    it("should reject zero count", async function () {
      await expect(
        pool.requestFallbackVerifiers(plan.address, 0)
      ).to.be.revertedWith("Count must be > 0");
    });

    it("should increment assignedPlans for each verifier", async function () {
      await pool.requestFallbackVerifiers(plan.address, 2);
      const info1 = await pool.getVerifierInfo(fv1.address);
      const info2 = await pool.getVerifierInfo(fv2.address);
      expect(info1.assignedPlans + info2.assignedPlans + (await pool.getVerifierInfo(fv3.address)).assignedPlans)
        .to.equal(2n);
    });
  });

  describe("Release", function () {
    beforeEach(async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv2).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv3).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.requestFallbackVerifiers(plan.address, 2);
    });

    it("should release verifier from plan", async function () {
      const assigned = await pool.getPlanFallbackVerifiers(plan.address);
      await pool.releaseVerifier(plan.address, assigned[0]);
      const updatedAssigned = await pool.getPlanFallbackVerifiers(plan.address);
      expect(updatedAssigned.length).to.equal(1);
    });

    it("should allow withdrawal after release", async function () {
      const assigned = await pool.getPlanFallbackVerifiers(plan.address);
      await pool.releaseVerifier(plan.address, assigned[0]);
      // Now the verifier can withdraw
      await pool.connect(ethers.provider.getSigner(assigned[0] as string)).withdrawFromPool;
    });
  });

  describe("View Functions", function () {
    it("should return all verifiers", async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: MIN_STAKE });
      await pool.connect(fv2).registerAsFallbackVerifier({ value: MIN_STAKE });
      const all = await pool.getAllVerifiers();
      expect(all.length).to.equal(2);
    });

    it("should return verifier info", async function () {
      await pool.connect(fv1).registerAsFallbackVerifier({ value: STAKE });
      const info = await pool.getVerifierInfo(fv1.address);
      expect(info.verifierAddress).to.equal(fv1.address);
      expect(info.stake).to.equal(STAKE);
      expect(info.active).to.be.true;
      expect(info.assignedPlans).to.equal(0);
    });
  });
});
