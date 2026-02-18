import { ethers, run, network } from "hardhat";

async function main() {
  console.log(`Deploying to ${network.name}...`);

  const Factory = await ethers.getContractFactory("InheriChainFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log(`InheriChainFactory deployed to: ${factoryAddress}`);

  if (network.name === "sepolia") {
    console.log("Waiting for block confirmations...");
    await factory.deploymentTransaction()?.wait(5);

    console.log("Verifying on Etherscan...");
    try {
      await run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [],
      });
      console.log("Verification successful!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("Contract already verified.");
      } else {
        console.error("Verification failed:", err.message);
      }
    }
  }

  console.log("\nUpdate your .env with:");
  console.log(`VITE_FACTORY_ADDRESS=${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
