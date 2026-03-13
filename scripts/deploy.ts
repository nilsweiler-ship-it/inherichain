import { ethers, run, network } from "hardhat";

async function main() {
  console.log(`Deploying to ${network.name}...`);

  // Deploy Factory (includes VerifierRegistry)
  const Factory = await ethers.getContractFactory("InheriChainFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const registryAddress = await factory.getRegistry();
  console.log(`InheriChainFactory deployed to: ${factoryAddress}`);
  console.log(`VerifierRegistry deployed to: ${registryAddress}`);

  // Deploy FallbackVerifierPool
  const Pool = await ethers.getContractFactory("FallbackVerifierPool");
  const pool = await Pool.deploy();
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log(`FallbackVerifierPool deployed to: ${poolAddress}`);

  if (network.name === "sepolia") {
    console.log("Waiting for block confirmations...");
    await factory.deploymentTransaction()?.wait(5);
    await pool.deploymentTransaction()?.wait(5);

    console.log("Verifying on Etherscan...");
    try {
      await run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [],
      });
      console.log("Factory verification successful!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("Factory already verified.");
      } else {
        console.error("Factory verification failed:", err.message);
      }
    }

    try {
      await run("verify:verify", {
        address: registryAddress,
        constructorArguments: [factoryAddress],
      });
      console.log("Registry verification successful!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("Registry already verified.");
      } else {
        console.error("Registry verification failed:", err.message);
      }
    }

    try {
      await run("verify:verify", {
        address: poolAddress,
        constructorArguments: [],
      });
      console.log("FallbackVerifierPool verification successful!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("Pool already verified.");
      } else {
        console.error("Pool verification failed:", err.message);
      }
    }
  }

  console.log("\nUpdate your .env with:");
  console.log(`VITE_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`VITE_FALLBACK_POOL_ADDRESS=${poolAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
