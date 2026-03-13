import { ethers, network } from "hardhat";

async function main() {
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.error("Seed script is for local development only!");
    process.exit(1);
  }

  const [owner, verifier1, verifier2, verifier3, heir1, heir2, fv1, fv2] = await ethers.getSigners();

  console.log("Deploying Factory...");
  const Factory = await ethers.getContractFactory("InheriChainFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const registryAddress = await factory.getRegistry();
  console.log(`Factory deployed to: ${factoryAddress}`);
  console.log(`Registry deployed to: ${registryAddress}`);

  console.log("\nDeploying FallbackVerifierPool...");
  const Pool = await ethers.getContractFactory("FallbackVerifierPool");
  const pool = await Pool.deploy();
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log(`FallbackVerifierPool deployed to: ${poolAddress}`);

  console.log("\nRegistering fallback verifiers...");
  const FV_STAKE = ethers.parseEther("0.5");
  await pool.connect(fv1).registerAsFallbackVerifier({ value: FV_STAKE });
  console.log(`  FV 1 (${fv1.address}): Staked ${ethers.formatEther(FV_STAKE)} ETH`);
  await pool.connect(fv2).registerAsFallbackVerifier({ value: FV_STAKE });
  console.log(`  FV 2 (${fv2.address}): Staked ${ethers.formatEther(FV_STAKE)} ETH`);

  console.log("\nCreating inheritance plan...");
  const SIXTY_DAYS = 60 * 24 * 60 * 60;
  const ONE_DAY = 24 * 60 * 60;
  const BOND = ethers.parseEther("1");
  const CHALLENGE_STAKE = ethers.parseEther("0.5");
  const GRACE_PERIOD = 7 * ONE_DAY;

  const planConfig = {
    requiredApprovals: 2n,
    totalVerifiers: 3n,
    verifierBond: BOND,
    challengePeriod: BigInt(ONE_DAY),
    challengeStake: CHALLENGE_STAKE,
    gracePeriod: BigInt(GRACE_PERIOD),
    recoveryAddress: ethers.ZeroAddress,
    phase2Delay: BigInt(14 * ONE_DAY),
    phase3Delay: BigInt(30 * ONE_DAY),
    autoRelease: false,
  };

  const tx = await factory.connect(owner).createPlan(
    "Family Trust",
    [verifier1.address, verifier2.address, verifier3.address],
    SIXTY_DAYS,
    planConfig
  );
  const receipt = await tx.wait();

  // Get plan address from event
  const event = receipt?.logs.find((log) => {
    try {
      return factory.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "PlanCreated";
    } catch { return false; }
  });
  const parsed = factory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
  const planAddress = parsed!.args.plan;
  console.log(`Plan deployed to: ${planAddress}`);

  const plan = await ethers.getContractAt("InheritancePlan", planAddress);

  // Set fallback pool on plan
  await plan.connect(owner).setFallbackPool(poolAddress);
  console.log(`  Fallback pool set on plan`);

  console.log("\nStaking verifiers...");
  await plan.connect(verifier1).stakeAsVerifier({ value: BOND });
  console.log(`  Verifier 1 (${verifier1.address}): Staked ${ethers.formatEther(BOND)} ETH`);
  await plan.connect(verifier2).stakeAsVerifier({ value: BOND });
  console.log(`  Verifier 2 (${verifier2.address}): Staked ${ethers.formatEther(BOND)} ETH`);
  await plan.connect(verifier3).stakeAsVerifier({ value: BOND });
  console.log(`  Verifier 3 (${verifier3.address}): Staked ${ethers.formatEther(BOND)} ETH`);

  console.log("\nAdding heirs...");
  await plan.connect(owner).addHeir(heir1.address, 6000, 0, 0, "Death certificate required");
  await factory.connect(owner).registerHeir(planAddress, heir1.address);
  console.log(`  Heir 1 (${heir1.address}): 60%, Death condition`);

  await plan.connect(owner).addHeir(heir2.address, 4000, 4, 25, "Must be 25 years old");
  await factory.connect(owner).registerHeir(planAddress, heir2.address);
  console.log(`  Heir 2 (${heir2.address}): 40%, Age condition (25)`);

  console.log("\nHeirs accepting inheritance...");
  await plan.connect(heir1).acceptInheritance();
  console.log(`  Heir 1 accepted`);
  await plan.connect(heir2).acceptInheritance();
  console.log(`  Heir 2 accepted`);

  console.log("\nFunding plan with 10 ETH...");
  await owner.sendTransaction({
    to: planAddress,
    value: ethers.parseEther("10"),
  });
  const balance = await ethers.provider.getBalance(planAddress);
  console.log(`Plan balance: ${ethers.formatEther(balance)} ETH (includes 3 ETH verifier bonds)`);

  console.log("\n--- Seed Summary ---");
  console.log(`Factory:         ${factoryAddress}`);
  console.log(`Registry:        ${registryAddress}`);
  console.log(`FallbackPool:    ${poolAddress}`);
  console.log(`Plan:            ${planAddress}`);
  console.log(`Owner:           ${owner.address}`);
  console.log(`Verifier 1:      ${verifier1.address} (staked)`);
  console.log(`Verifier 2:      ${verifier2.address} (staked)`);
  console.log(`Verifier 3:      ${verifier3.address} (staked)`);
  console.log(`Heir 1:          ${heir1.address} (accepted)`);
  console.log(`Heir 2:          ${heir2.address} (accepted)`);
  console.log(`Fallback V1:     ${fv1.address} (staked)`);
  console.log(`Fallback V2:     ${fv2.address} (staked)`);
  console.log(`\nConfig: 2-of-3 verification, 1 ETH bond, 0.5 ETH challenge stake, 1 day challenge period`);
  console.log(`\nSet in frontend/.env:`);
  console.log(`  VITE_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`  VITE_FALLBACK_POOL_ADDRESS=${poolAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
