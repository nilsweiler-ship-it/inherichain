import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, injectedWallet],
    },
  ],
  {
    appName: "InheriChain",
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "placeholder",
  }
);

export const config = createConfig({
  connectors,
  chains: [hardhat, sepolia],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(),
  },
});
