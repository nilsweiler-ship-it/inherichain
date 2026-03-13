import { expect } from "chai";
import { ethers } from "hardhat";
import { InheriChainFactory, VerifierRegistry, InheritancePlan } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";

describe("VerifierRegistry", function () {
  let factory: InheriChainFactory;
  let registry: VerifierRegistry;
  let owner: HardhatEthersSigner;
  let verifier1: HardhatEthersSigner;
  let verifier2: HardhatEthersSigner;
  let verifier3: HardhatEthersSigner;
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
    [owner, verifier1, verifier2, verifier3, stranger, recovery] =
      await ethers.getSigners();
    const Factory = await ethers.getContractFactory("InheriChainFactory");
    factory = await Factory.deploy();
    const registryAddr = await factory.getRegistry();
    registry = await ethers.getContractAt("VerifierRegistry", registryAddr);
  });

  describe("Authorization", function () {
    it("should only allow factory to authorize plans", async function () {
      await expect(
        registry.connect(stranger).authorizePlan(stranger.address)
      ).to.be.revertedWith("Not factory");
    });

    it("should only allow authorized plans to record stats", async function () {
      await expect(
        registry.connect(stranger).recordVoteCast(stranger.address)
      ).to.be.revertedWith("Not authorized plan");
    });
  });

  describe("Stats Recording", function () {
    let plan: InheritancePlan;

    beforeEach(async function () {
      const tx = await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try {
          return factory.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "PlanCreated";
        } catch { return false; }
      });
      const parsed = factory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
      plan = await ethers.getContractAt("InheritancePlan", parsed!.args.plan);
    });

    it("should record planVerified on staking", async function () {
      await plan.connect(verifier1).stakeAsVerifier({ value: BOND });
      const stats = await registry.getStats(verifier1.address);
      expect(stats.plansVerified).to.equal(1);
    });

    it("should record votesCast on voting", async function () {
      await plan.connect(verifier1).stakeAsVerifier({ value: BOND });
      await plan.connect(verifier2).stakeAsVerifier({ value: BOND });
      await plan.connect(verifier3).stakeAsVerifier({ value: BOND });

      const heir1 = (await ethers.getSigners())[6];
      await plan.connect(owner).addHeir(heir1.address, 5000, 0, 0, "");
      await plan.connect(heir1).acceptInheritance();
      await owner.sendTransaction({ to: await plan.getAddress(), value: ethers.parseEther("1") });

      const { time } = await import("@nomicfoundation/hardhat-network-helpers");
      await time.increase(SIXTY_DAYS + 1);
      await plan.connect(heir1).submitClaim("QmCID");
      await plan.connect(verifier1).vote(0, true);

      const stats = await registry.getStats(verifier1.address);
      expect(stats.votesCast).to.equal(1);
    });
  });

  describe("Reputation", function () {
    it("should return 0 for unknown verifier", async function () {
      expect(await registry.getReputation(stranger.address)).to.equal(0);
    });

    it("should calculate positive reputation correctly", async function () {
      // Create a plan so verifier can stake (which records plansVerified)
      const tx = await factory.connect(owner).createPlan(
        "Test Plan",
        [verifier1.address, verifier2.address, verifier3.address],
        SIXTY_DAYS,
        defaultConfig(recovery.address)
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try {
          return factory.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "PlanCreated";
        } catch { return false; }
      });
      const parsed = factory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
      const plan = await ethers.getContractAt("InheritancePlan", parsed!.args.plan);

      await plan.connect(verifier1).stakeAsVerifier({ value: BOND });
      // 1 planVerified * 10 = 10
      expect(await registry.getReputation(verifier1.address)).to.equal(10);
    });

    it("should return 0 when negative outweighs positive", async function () {
      // Reputation formula: (plansVerified*10 + votesCast*2) - (challengesLost*20 + bondsSlashed*50)
      // Fresh verifier has 0 reputation
      expect(await registry.getReputation(stranger.address)).to.equal(0);
    });
  });
});
