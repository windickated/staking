/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Centralized type definitions shared between the GraphQL client, stores, and UI.

// Raw entities as they come from the HyperIndex GraphQL service.
type RawStakedNFT = {
  tokenId: string;
  votingPower: string;
  lockMonths: number;
  stakedAt: string;
  unlockTime: string;
  isStaked: boolean;
};

// Token shape used throughout Svelte stores and UI components.
type TokenState = {
  tokenId: number;
  votingPower: number;
  lockMonths: number;
  stakedAt: number;
  unlockTime: number;
  isStaked: boolean;
  selected: boolean;
};

// On-chain stake info normalization (used in fallbacks).
type StakeInfo = {
  tokenId: number;
  startTime: number;
  unlockTime: number;
  lockMonths: number;
  owner: string;
};

// Raw user snapshot from the indexer.
type RawUser = {
  totalVotingPower: string;
  accumulatedPoints: string;
  stakedNFTCount: number;
  lastUpdateTime: string;
};

// Cached user metrics for the header/stats cards.
type UserStats = {
  totalVotingPower: bigint;
  accumulatedPoints: number;
  currentPoints: number;
  pointsPerSecond: number;
  stakedNFTCount: number;
};

// Raw global snapshot from the indexer.
type RawGlobalState = {
  totalVotingPower: string;
  totalStakedNFTs: number;
};

// Cached global metrics for high-level stats.
type GlobalStats = {
  totalVotingPower: bigint;
  totalStakedNFTs: number;
};

// Normalized user-level staking data the app consumes after parsing raw fields.
type UserStakingData = {
  stakedNFTs: RawStakedNFT[];
  totalVotingPower: bigint;
  accumulatedPoints: number;
  currentPoints: number;
  pointsPerSecond: number;
  stakedNFTCount: number;
};
