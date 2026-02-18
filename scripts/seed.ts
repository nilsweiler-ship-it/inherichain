import { ethers, network } from "hardhat";

async function main() {
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.error("Seed script is for local development only!");
    process.exit(1);
  }

  const [owner, verifier1, verifier2, verifier3, heir1, heir2] = await ethers.getSigners();

  console.log("Deploying Factory...");
  const Factory = await ethers.getContractFactory("InheriChainFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`Factory deployed to: ${factoryAddress}`);

  console.log("\nCreating inheritance plan...");
  const SIXTY_DAYS = 60 * 24 * 60 * 60;
  const tx = await factory.connect(owner).createPlan(
    "Family Trust",
    [verifier1.address, verifier2.address, verifier3.address],
    SIXTY_DAYS
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

  console.log("\nAdding heirs...");
  await plan.connect(owner).addHeir(heir1.address, 6000, 0, 0, "Death certificate required");
  await factory.connect(owner).registerHeir(planAddress, heir1.address);
  console.log(`  Heir 1 (${heir1.address}): 60%, Death condition`);

  await plan.connect(owner).addHeir(heir2.address, 4000, 4, 25, "Must be 25 years old");
  await factory.connect(owner).registerHeir(planAddress, heir2.address);
  console.log(`  Heir 2 (${heir2.address}): 40%, Age condition (25)`);

  console.log("\nFunding plan with 10 ETH...");
  await owner.sendTransaction({
    to: planAddress,
    value: ethers.parseEther("10"),
  });
  const balance = await ethers.provider.getBalance(planAddress);
  console.log(`Plan balance: ${ethers.formatEther(balance)} ETH`);

  console.log("\n--- Seed Summary ---");
  console.log(`Factory:    ${factoryAddress}`);
  console.log(`Plan:       ${planAddress}`);
  console.log(`Owner:      ${owner.address}`);
  console.log(`Verifier 1: ${verifier1.address}`);
  console.log(`Verifier 2: ${verifier2.address}`);
  console.log(`Verifier 3: ${verifier3.address}`);
  console.log(`Heir 1:     ${heir1.address}`);
  console.log(`Heir 2:     ${heir2.address}`);
  console.log("\nSet VITE_FACTORY_ADDRESS=${factoryAddress} in frontend/.env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
