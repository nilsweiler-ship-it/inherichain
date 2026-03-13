# Inherichain — Product Specification

## Overview
Decentralized digital inheritance platform built on Ethereum that allows crypto-native individuals to create smart contract-based inheritance plans for their digital assets without intermediaries. Name derives from "Inheritance + Chainlink."

## Stage
MVP on Sepolia testnet — full happy path end-to-end working first.

## Core User Flow (MVP)
Create plan → Share invite links with heirs → Heirs accept → Fund plan → Inactivity triggers → Heir submits claim + documents → Oracle validates + Verifiers vote → Challenge period → Progressive distribution

## Target Audience
Crypto-native individuals holding significant crypto who want to plan inheritance without lawyers.

## Key USPs
- **Conditional inheritance**: Per-heir conditions (age, education, life events) — not just "owner is dead"
- **Fully modifiable plans**: Owner can update everything (heirs, conditions, verifiers, timings) while no claim is in progress
- **Decentralized verification**: Hybrid oracle + human verifier model with fallback pool
- **Privacy-first**: Plans are private, documents encrypted, fallback verifiers see anonymized data only

---

## Product Decisions

### Asset Support
- **MVP**: ETH only
- **v1**: ETH + ERC-20 tokens (USDC, DAI, etc.)
- **v2**: ETH + ERC-20 + NFTs (ERC-721/1155)
- **Future**: Multi-chain support (Polygon, Arbitrum, Base, etc.)

### Identity
- Wallet-only — users identified purely by Ethereum address
- No accounts, no registration, fully pseudonymous

### Revenue Model
- **MVP**: No fees
- **Post-MVP**: Monthly or yearly subscription to keep plans active (on-chain or off-chain payment rails)

### Plan Visibility
- Plans are **private** — only the owner, named heirs, and assigned verifiers can see plan details

---

## Plan Creation Parameters

When an owner creates a plan, they configure:

| Parameter | Description |
|---|---|
| **Heir addresses** | One or more heir wallet addresses with percentage splits (e.g., Alice 60%, Bob 40%) |
| **Conditions per heir** | Predefined types + free text; certain conditions require specific document types as proof |
| **Required document types** | Per condition (e.g., "college degree" condition requires diploma upload) |
| **Verifier addresses** | Owner-selected trusted individuals |
| **M-of-N voting threshold** | How many verifiers must approve (e.g., 2-of-3) |
| **Inactivity timeout** | Customizable period before inactivity is triggered; owner also sets minimum |
| **Distribution stage delays** | Time between each progressive distribution tranche (owner-configurable) |
| **Distribution mode** | Heir-triggered (must send tx per stage) OR auto-release on timer — owner chooses |
| **Challenge period duration** | Owner-configurable window after verifier approval |
| **Pre-approved challengers** | Specific addresses allowed to challenge a claim |
| **Backup heir** | Fallback heir address in case primary heir's wallet is lost |

### Plan Modification
- Owner can modify **all parameters** at any time while no claim is in progress
- **Locked during active claims** — no modifications allowed while a claim is being processed

---

## Predefined Condition Types

| Condition | Required Document | Oracle-Verifiable |
|---|---|---|
| Death of owner | Death certificate | Yes |
| Age threshold (heir ≥ X years) | Birth certificate / ID | Yes |
| College degree | Diploma / transcript | Partial |
| Marriage | Marriage certificate | Partial |
| Birth of grandchild / great-grandchild | Birth certificate | Partial |
| Custom (free text) | Owner-specified or none | No — verifier-only |

- All conditions require **double confirmation**: both oracle validation AND verifier approval
- Oracle provides data/validation; verifiers make the final human judgment call
- Neither can override the other — both must agree

---

## Heir Flow

### Invitation & Acceptance
1. Owner creates plan and adds heir addresses
2. System emits **on-chain event** for each named heir
3. Owner shares an **invitation link** with heirs (e.g., `inherichain.xyz/plan/0xABC`)
4. Heir visits link, **connects wallet**, and accepts — registered on-chain
5. If heir **never accepts**, plan sits indefinitely (no timeout)
6. Owner can **revoke** an heir before they accept

### Claim Process
1. Heir initiates claim (only heirs can initiate — not verifiers)
2. Heir **uploads required documents** (death certificate, condition-specific docs)
3. Documents stored on **IPFS** (encrypted), hash recorded on-chain
4. Oracle validates documents + verifiers review and vote (M-of-N)
5. Both oracle AND verifiers must approve (double confirmation)
6. Challenge period begins after approval
7. Progressive distribution executes according to plan settings

---

## Verification System

### Verifier Tiers
- **Owner-selected contacts**: Friends, family, trusted individuals — can stake less than professionals
- **Curated professionals**: KYC'd lawyers, notaries — must be approved before staking
- **Fallback pool** (decentralized): Ecosystem verifiers who step in if all assigned verifiers are slashed/inactive

### Staking
- **Minimum stake**: 0.1 ETH (configurable per plan, owner can set higher)
- Owner-selected verifiers may stake **less** than curated professionals
- Fallback verifiers must meet minimum stake requirements

### Slashing
- Verifiers who **go inactive** (don't vote within required timeframe) are slashed
- Slashed stakes go to the **heir**
- Challengers who lose also get slashed — stake goes to heir

### Fallback Verifier Pool
- Activated when **all assigned verifiers** are slashed or inactive
- Fallback verifiers **earn ETH** for verification work
- Documents are **anonymized/redacted** for fallback verifiers (privacy protection)
- M-of-N threshold for fallback verifiers uses system default (TBD)

---

## Challenge System

- **Challenge window**: Owner-configurable duration after verifier approval
- **Who can challenge**: Only **pre-approved addresses** defined by the owner at plan creation
- **Challenger stake**: TBD — must stake ETH to challenge
- **Process**: Challenger stakes → verifiers re-evaluate → loser's stake is slashed (sent to heir)

---

## Progressive Distribution

4-layer security before funds are released:

1. **Verifier Staking** — verifiers have skin in the game
2. **M-of-N Voting** — threshold-based approval
3. **Challenge Period** — window for disputes
4. **Progressive Distribution** — staged release (default: 10% → 40% → 50%)

- **Stage delays**: Owner-configurable time between each tranche
- **Distribution mode**: Owner chooses at plan creation:
  - **Heir-triggered**: Heir must send a transaction to claim each stage
  - **Auto-release**: Funds release automatically on a timer
- Owner can **cancel distribution** mid-way if a mistake was made (only while owner is alive / plan not fully executed)

---

## Inactivity Check-in

- **Timeout period**: Fully customizable by the owner
- **Minimum inactivity period**: Also customizable by the owner (prevents accidental triggers)
- **Push reminders**: Off-chain notifications warn owner before deadline approaches
- **Check-in methods**:
  - On-chain transaction
  - Signed message (gasless, EIP-712)
  - External activity detection (e.g., ENS renewal, DEX trade)

---

## Document Storage

- Documents uploaded to **IPFS** via Pinata (backend service)
- All documents are **encrypted** before upload
- Document hash stored on-chain as proof
- Document types: death certificates, birth certificates, diplomas, marriage certificates, etc.
- **Anonymization**: Documents shown to fallback verifiers are redacted/blackened to protect privacy
- Off-chain documents are **required** for claim resolution — not everything can resolve purely on-chain

---

## Notifications

- **On-chain events**: Emitted for all key actions (claim submitted, vote cast, challenge raised, distribution executed)
- **Heir notification**: On-chain event + owner shares invitation link
- **Push notifications** (post-MVP): Browser push for real-time alerts
- **Email** (post-MVP): Alerts for critical events

---

## Oracle Integration

- **Chainlink** oracle for automated document/condition verification
- Double confirmation model: oracle validates AND verifiers approve — both required
- Oracle verifies conditions where structured data is available (death records, age verification)
- Human verifiers handle subjective or complex conditions

---

## Roadmap — Features to Build

### Phase 1: MVP (Current → Testnet Demo)
- [ ] Full happy path: create → fund → inactivity → claim → verify → distribute
- [ ] Multi-heir support with percentage splits
- [ ] Conditional inheritance (predefined types + free text)
- [ ] Heir invitation flow (link sharing + wallet acceptance)
- [ ] Owner plan modification (full parameter editing)
- [ ] Progressive distribution (owner-configurable mode + delays)
- [ ] Challenge period with pre-approved challengers
- [ ] Backup heir designation
- [ ] Document upload to IPFS (encrypted)
- [ ] Chainlink oracle integration for document validation
- [ ] Verifier staking + slashing (inactive verifiers)
- [ ] Fallback verifier pool (anonymized documents)
- [ ] Seed script + local Hardhat demo
- [ ] Legal disclaimers (jurisdiction-agnostic warning)
- [ ] All pages functional with real contract interactions

### Phase 2: Asset Expansion
- [ ] ERC-20 token support in InheritancePlan contract
- [ ] NFT (ERC-721/1155) support in InheritancePlan contract
- [ ] Frontend UI for managing token/NFT inheritance
- [ ] Token approval flows in frontend

### Phase 3: Verification Upgrade
- [ ] Tiered verifier system (curated registry + owner-selected)
- [ ] AI document pre-screening service (backend)
- [ ] Advanced oracle integration for more condition types

### Phase 4: Notifications & Check-in
- [ ] Push notification service (browser)
- [ ] Email notification service (claim events, inactivity warnings)
- [ ] Gasless check-in via signed messages (EIP-712)
- [ ] External activity detection for check-in

### Phase 5: Revenue & Sustainability
- [ ] Subscription payment logic (on-chain or off-chain)
- [ ] Plan expiration / renewal mechanism
- [ ] Fee structure and pricing tiers

### Phase 6: Mobile & Multi-chain
- [ ] Mobile-responsive frontend or native app
- [ ] Multi-chain deployment (Polygon, Arbitrum, Base)
- [ ] Cross-chain asset support

---

## Architecture

### Smart Contracts (Solidity)
- **InheriChainFactory** — Creates and tracks inheritance plans
- **InheritancePlan** — Individual plan with full parameter set (heirs, conditions, verifiers, distribution config)
- **VerifierRegistry** — Reputation tracking, staking, slashing for verifiers
- **FallbackVerifierPool** — Decentralized pool of ecosystem verifiers for fallback scenarios

### Frontend (React + Vite + TypeScript)
- Wagmi + RainbowKit for wallet connection
- TailwindCSS for styling
- React Router for navigation
- Pages: Landing, Create Plan, Owner Dashboard, Heir Dashboard, Verifier Panel, Plan Detail

### Marketing Site (React + Vite)
- Single-page marketing site with comparison tables, USPs, FAQ
- Separate from the app frontend

### Backend (Express + TypeScript)
- IPFS uploads via Pinata (with encryption)
- Document anonymization service for fallback verifiers
- Future: notification service, AI verification, subscription management

### Networks
- **Development**: Hardhat local node
- **Testnet**: Sepolia
- **Future**: Ethereum mainnet, L2s
