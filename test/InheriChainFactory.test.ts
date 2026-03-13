import { expect } from "chai";
import { ethers } from "hardhat";
import { InheriChainFactory, InheritancePlan, VerifierRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";

describe("InheriChainFactory", function () {
  let factory: InheriChainFactory;
  let registry: VerifierRegistry;
  let owner: HardhatEthersSigner;
  let verifier1: HardhatEthersSigner;
  let verifier2: HardhatEthersSigner;
  let verifier3: HardhatEthersSigner;
  let heir1: HardhatEthersSigner;
  let heir2: HardhatEthersSigner;
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
    [owner, verifier1, verifier2, verifier3, heir1, heir2, stranger, recovery] =
      await ethers.getSigners();
    const Factory = await ethers.getContractFactory("InheriChainFactory");
    factory = await Factory.deploy();
    const registryAddr = await factory.getRegistry();
    registry = await ethers.getContractAt("VerifierRegistry", registryAddr);
  });

  describe("Registry Deployment", function () {
    it("should deploy a registry in constructor", async function () {
      const registryAddr = await factory.getRegistry();
      expect(registryAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("should set factory as registry owner", async function () {
      expect(await registry.factory()).to.equal(await factory.getAddress());
    });
  });

  describe("createPlan", function () {
    it("should create a new plan and emit event", async function () {
      const tx = await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => {
          try {
            return factory.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "PlanCreated";
          } catch { return false; }
        }
      );
      expect(event).to.not.be.undefined;
    });

    it("should register plan in ownerPlans", async function () {
      await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const plans = await factory.getOwnerPlans(owner.address);
      expect(plans.length).to.equal(1);
    });

    it("should register plan in verifierPlans for all verifiers", async function () {
      await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      expect((await factory.getVerifierPlans(verifier1.address)).length).to.equal(1);
      expect((await factory.getVerifierPlans(verifier2.address)).length).to.equal(1);
      expect((await factory.getVerifierPlans(verifier3.address)).length).to.equal(1);
    });

    it("should authorize plan in registry", async function () {
      await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const plans = await factory.getOwnerPlans(owner.address);
      expect(await registry.authorizedPlans(plans[0])).to.be.true;
    });

    it("should create multiple plans for same owner", async function () {
      await factory.connect(owner).createPlan(
        "Plan 1",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      await factory.connect(owner).createPlan(
        "Plan 2",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      expect(await factory.getPlanCount()).to.equal(2);
    });

    it("should deploy a functional InheritancePlan contract", async function () {
      await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const plans = await factory.getOwnerPlans(owner.address);
      const plan = await ethers.getContractAt("InheritancePlan", plans[0]);
      expect(await plan.owner()).to.equal(owner.address);
      expect(await plan.planName()).to.equal("Test Plan");
    });
  });

  describe("registerHeir", function () {
    let planAddress: string;

    beforeEach(async function () {
      await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const plans = await factory.getOwnerPlans(owner.address);
      planAddress = plans[0];
      const plan = await ethers.getContractAt("InheritancePlan", planAddress);
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
    });

    it("should register heir in heirPlans", async function () {
      await factory.connect(owner).registerHeir(planAddress, heir1.address);
      const heirPlansList = await factory.getHeirPlans(heir1.address);
      expect(heirPlansList.length).to.equal(1);
      expect(heirPlansList[0]).to.equal(planAddress);
    });

    it("should reject non-owner registering heir", async function () {
      await expect(
        factory.connect(stranger).registerHeir(planAddress, heir1.address)
      ).to.be.revertedWith("Only plan owner");
    });

    it("should reject registering non-heir", async function () {
      await expect(
        factory.connect(owner).registerHeir(planAddress, heir2.address)
      ).to.be.revertedWith("Not heir on plan");
    });

    it("should reject zero plan address", async function () {
      await expect(
        factory.connect(owner).registerHeir(ethers.ZeroAddress, heir1.address)
      ).to.be.revertedWith("Invalid plan");
    });

    it("should reject zero heir address", async function () {
      await expect(
        factory.connect(owner).registerHeir(planAddress, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid heir");
    });
  });

  describe("View Functions", function () {
    it("should return empty arrays for addresses with no plans", async function () {
      expect((await factory.getOwnerPlans(stranger.address)).length).to.equal(0);
      expect((await factory.getHeirPlans(stranger.address)).length).to.equal(0);
      expect((await factory.getVerifierPlans(stranger.address)).length).to.equal(0);
    });

    it("should return all plans", async function () {
      await factory.connect(owner).createPlan(
        "Plan 1",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const allPlans = await factory.getAllPlans();
      expect(allPlans.length).to.equal(1);
    });

    it("should return correct plan count", async function () {
      expect(await factory.getPlanCount()).to.equal(0);
      await factory.connect(owner).createPlan(
        "Plan 1",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      expect(await factory.getPlanCount()).to.equal(1);
    });
  });
});
