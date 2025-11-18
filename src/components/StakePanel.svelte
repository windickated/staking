<script lang="ts">
  import type { BrowserProvider } from 'ethers';

  import { setApprovalForAll, isApprovedForAll } from '@lib/potentials';
  import {
    address,
    provider,
    connected,
    walletReady,
    myTokens,
    userStats,
    globalStats,
    dataStatus,
    busy as busyStore,
    isPaused as pausedStore,
  } from '@stores/web3.svelte';
  import { stakingContract, isPaused, stakeTokens } from '@lib/staking';
  import { getUserStakingData, getGlobalStats } from '@lib/indexer';
  import { getOwnedTokenSet } from '@lib/potentials';
  import { STAKING_ADDRESS } from '@lib/contract';
  import { toastStore } from '@stores/toast.svelte';

  import WalletConnect from '@components/web3/WalletConnect.svelte';
  import RefreshSVG from '@components/icons/Refresh.svelte';
  import ContractSVG from '@components/icons/Contract.svelte';
  import LoadingSVG from '@components/icons/Loading.svelte';

  const LOCK_OPTIONS = [1, 3, 6, 12];
  const DEFAULT_LOCK = 6;
  const readOnlyStaking = stakingContract();
  const stakingReady = Boolean(readOnlyStaking?.target ?? STAKING_ADDRESS);

  let approved = $state(false);

  const selectedTokens = $derived(
    $myTokens.filter((token) => token.selected && !token.isStaked),
  );
  const selectionCount = $derived(selectedTokens.length);
  const availableCount = $derived(
    $myTokens.filter((token) => !token.isStaked).length,
  );
  const stakingDisabled = $derived(
    !$connected ||
      !stakingReady ||
      !approved ||
      !selectionCount ||
      $pausedStore ||
      $busyStore !== 'idle',
  );
  const approveDisabled = $derived(
    approved || !stakingReady || !$connected || $busyStore !== 'idle',
  );

  let loadingData = false;

  // Map raw GraphQL entries into Svelte-friendly objects.
  function normalizeToken(raw: RawStakedNFT): TokenState {
    return {
      tokenId: Number(raw.tokenId),
      votingPower: Number(raw.votingPower ?? 0),
      lockMonths: Number(raw.lockMonths ?? DEFAULT_LOCK) || DEFAULT_LOCK,
      stakedAt: Number(raw.stakedAt ?? 0),
      unlockTime: Number(raw.unlockTime ?? 0),
      isStaked: Boolean(raw.isStaked),
      selected: false,
    };
  }

  // Refresh both user + global snapshots once per wallet load/refresh.
  async function loadStakingData(addr: string) {
    if (loadingData) return;
    loadingData = true;
    busyStore.set('fetch');
    dataStatus.set('loading');

    try {
      // --- Temporary fallback: on-chain owned scan until we use Potentials API ---
      const ownedPromise = getOwnedTokenSet(addr as `0x${string}`);
      const owned = await ownedPromise;
      // ---------------------------------------------------------------------------

      const [userData, globalSnapshot] = await Promise.all([
        getUserStakingData(addr),
        getGlobalStats(),
      ]);

      // Stats can render immediately even while owner scan finishes.
      const stakedTokens = userData.stakedNFTs.map(normalizeToken);

      userStats.set({
        totalVotingPower: userData.totalVotingPower,
        accumulatedPoints: userData.accumulatedPoints,
        currentPoints: userData.currentPoints,
        pointsPerSecond: userData.pointsPerSecond,
        stakedNFTCount: userData.stakedNFTCount,
      });

      globalStats.set(globalSnapshot);

      // Merge indexer (staked) with on-chain owned (unstaked) tokens.
      const merged = new Map<number, TokenState>();

      stakedTokens.forEach((token) => {
        merged.set(token.tokenId, token);
      });

      // --- Temporary fallback merge for owned-but-unstaked tokens ----------------
      owned.ids.forEach((tokenId) => {
        if (merged.has(tokenId)) return;
        merged.set(tokenId, {
          tokenId,
          votingPower: 0,
          lockMonths: DEFAULT_LOCK,
          stakedAt: 0,
          unlockTime: 0,
          isStaked: false,
          selected: false,
        });
      });
      // ---------------------------------------------------------------------------

      const tokens = Array.from(merged.values()).sort(
        (a, b) => a.tokenId - b.tokenId,
      );
      myTokens.set(tokens);

      if (!tokens.length) {
        dataStatus.set('empty');
      } else {
        dataStatus.set('ready');
      }
    } catch (err) {
      console.error(err);
      dataStatus.set('error');
      toastStore.show(
        'Unable to load staking data, please try refreshing',
        'error',
      );
    } finally {
      busyStore.set('idle');
      loadingData = false;
    }
  }

  // Approval is still handled on-chain via ethers. Cache status so UI can gate stake button.
  async function refreshApproval(addr: string) {
    if (!stakingReady) return;
    try {
      approved = await isApprovedForAll(addr, STAKING_ADDRESS);
    } catch (err) {
      console.error(err);
    }
  }

  // Ping the contract (read-only) to see if staking is paused.
  async function refreshPausedState() {
    try {
      const currentProvider = $provider as BrowserProvider | null;
      const paused = currentProvider
        ? await isPaused(currentProvider)
        : await readOnlyStaking.isStakingPaused();
      pausedStore.set(!!paused);
    } catch (err) {
      console.error(err);
    }
  }

  // UI-only selection helpers (non-staked tokens only).
  function toggleSelection(tokenId: number, selectedValue: boolean) {
    myTokens.update((tokens) =>
      tokens.map((token) => {
        if (token.tokenId !== tokenId || token.isStaked) return token;
        return { ...token, selected: selectedValue };
      }),
    );
  }

  function updateLock(tokenId: number, monthsValue: number) {
    myTokens.update((tokens) =>
      tokens.map((token) => {
        if (token.tokenId !== tokenId || token.isStaked) return token;
        return { ...token, lockMonths: monthsValue };
      }),
    );
  }

  function onRefreshClick() {
    const current = $address;
    if (!current) return;
    loadStakingData(current);
  }

  async function handleApprove() {
    if (!stakingReady) {
      toastStore.show('Set PUBLIC_STAKING_ADDRESS to continue', 'error');
      return;
    }

    const current = $address;
    if (!current) {
      toastStore.show('Connect a wallet first', 'error');
      return;
    }

    const currentProvider = $provider as BrowserProvider | null;
    if (!currentProvider) {
      toastStore.show('Connect a wallet first', 'error');
      return;
    }

    busyStore.set('approve');

    try {
      const signer = await currentProvider.getSigner();
      await setApprovalForAll(signer, STAKING_ADDRESS, true);
      approved = true;
      toastStore.show('Staking contract approved');
    } catch (err) {
      console.error(err);
      toastStore.show('Approval transaction failed', 'error');
    } finally {
      busyStore.set('idle');
    }
  }

  async function handleStake() {
    if (!stakingReady) {
      toastStore.show('Set PUBLIC_STAKING_ADDRESS to continue', 'error');
      return;
    }

    const current = $address;
    const currentProvider = $provider as BrowserProvider | null;

    if (!current || !currentProvider) {
      toastStore.show('Connect a wallet first', 'error');
      return;
    }

    const selection = selectedTokens;
    if (!selection.length) {
      toastStore.show('Select at least one NFT to stake', 'error');
      return;
    }

    const tokenIds = selection.map((token) => token.tokenId);
    const months = selection.map((token) => token.lockMonths);

    if (months.some((value) => !LOCK_OPTIONS.includes(value))) {
      toastStore.show('Choose a valid lock duration for each NFT', 'error');
      return;
    }

    busyStore.set('stake');

    try {
      const signer = await currentProvider.getSigner();
      await stakeTokens(signer, tokenIds, months);
      toastStore.show(
        `Staked ${tokenIds.length} NFT${tokenIds.length > 1 ? 's' : ''} successfully`,
      );
      await loadStakingData(current);
    } catch (err) {
      console.error(err);
      toastStore.show('Staking transaction failed', 'error');
    } finally {
      busyStore.set('idle');
    }
  }

  $effect(() => {
    const current = $address;
    connected.set(!!current);
    if (!current) {
      approved = false;
      myTokens.set([]);
      userStats.set(null);
      globalStats.set(null);
      dataStatus.set('idle');
      pausedStore.set(false);
      return;
    }
    refreshApproval(current);
    loadStakingData(current);
  });

  $effect(() => {
    $provider;
    refreshPausedState();
  });

  // Formatting helpers for the metric cards.
  function formatBigInt(value?: bigint | null) {
    if (value === undefined || value === null) return '0';
    return value.toString();
  }

  function formatPoints(value?: number | null, digits = 2) {
    if (value === undefined || value === null || Number.isNaN(value))
      return '0';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatPerSecond(value?: number | null) {
    if (!value) return '0 pts/s';
    return `${value.toFixed(4)} pts/s`;
  }
</script>

<h1 class="sr-only">Potentials Staking</h1>

<h5 class="mar-inline">Select NFTs, choose a lock, and stake them together.</h5>

<section class="flex">
  {#if $connected}
    <header class="flex pad pad-inline shad">
      <h4>Potentials Staking</h4>
      <span class="flex-row flex-wrap">
        <RefreshSVG
          onclick={onRefreshClick}
          text={$busyStore === 'fetch' ? 'Fetching…' : 'Refresh'}
          disabled={$busyStore === 'fetch'}
        />
        <ContractSVG
          onclick={handleApprove}
          text={approved
            ? 'Approved'
            : $busyStore === 'approve'
              ? 'Approving…'
              : 'Approve staking contract'}
          disabled={approveDisabled}
        />
      </span>
    </header>

    <div class="panel container">
      {#if !stakingReady}
        <p class="validation">
          Set <code>PUBLIC_STAKING_ADDRESS</code> in your .env file to enable staking.
        </p>
      {/if}

      {#if $pausedStore}
        <p class="validation">
          Staking is temporarily paused. Unstake remains available after unlock.
        </p>
      {/if}

      {#if $userStats || $globalStats}
        <div class="stats flex">
          <article>
            <p>Your voting power</p>
            <h4>{formatBigInt($userStats?.totalVotingPower)}</h4>
          </article>
          <article>
            <p>Current points</p>
            <h4>
              {formatPoints($userStats?.currentPoints)}
              <strong>
                ({formatPerSecond($userStats?.pointsPerSecond)})
              </strong>
            </h4>
          </article>
          <article>
            <p>Staked NFTs</p>
            <h4>
              {($userStats?.stakedNFTCount ?? 0).toLocaleString()}
            </h4>
          </article>
        </div>

        <div class="stats flex">
          <article>
            <p>Global voting power</p>
            <h4>{formatBigInt($globalStats?.totalVotingPower)}</h4>
          </article>
          <article>
            <p>Total staked NFTs</p>
            <h4>
              {($globalStats?.totalStakedNFTs ?? 0).toLocaleString()}
            </h4>
          </article>
        </div>
      {/if}

      {#if availableCount}
        <h5>
          {availableCount} / {$myTokens.length} NFTs available for staking
        </h5>
      {:else if $myTokens.length}
        <h5>All {$myTokens.length} NFTs are currently staked</h5>
      {/if}

      {#if $dataStatus === 'loading'}
        <span class="flex-row gap">
          <LoadingSVG />
          <h5>Loading staking data…</h5>
        </span>
      {:else if $dataStatus === 'empty'}
        <p class="validation">No Potentials NFTs were found for this wallet</p>
      {:else if $myTokens.length === 0}
        <p class="validation">
          Data loaded, but no NFTs are currently available for staking
        </p>
      {:else}
        <div class="flex-row flex-wrap gap">
          {#each $myTokens as token (token.tokenId)}
            <button
              class="tile void-btn"
              class:green-tile={token.selected}
              class:potential-tile={token.isStaked || $pausedStore}
              disabled={token.isStaked || $pausedStore}
              onclick={() => toggleSelection(token.tokenId, !token.selected)}
              aria-label={`Select token ${token.tokenId}`}
            >
              <img
                src={`https://api.dgrslabs.ink/nft/image/${token.tokenId}`}
                alt={`Potential #${token.tokenId}`}
              />
              <h5>Potential #{token.tokenId}</h5>

              <span class="tile-data">
                {#if token.isStaked}
                  <p>Staked at {token.stakedAt.toLocaleString()}</p>
                  <p>Unlocks at {token.unlockTime.toLocaleString()}</p>
                {:else}
                  <label class="lock-label">
                    Available for Stake
                    <select
                      value={token.lockMonths}
                      disabled={token.isStaked || $pausedStore}
                      onchange={(event) =>
                        updateLock(
                          token.tokenId,
                          Number(event.currentTarget.value),
                        )}
                    >
                      {#each LOCK_OPTIONS as months}
                        <option value={months}>
                          {months}
                          {months === 1 ? 'month' : 'months'}
                        </option>
                      {/each}
                    </select>
                  </label>
                {/if}
              </span>
            </button>
          {/each}
        </div>

        <button class="cta" onclick={handleStake} disabled={stakingDisabled}>
          {#if $busyStore === 'stake'}
            Staking…
          {:else}
            Stake selected NFTs ({selectionCount})
          {/if}
        </button>
      {/if}
    </div>
  {:else}
    <div class="container">
      <span hidden={!$walletReady}>
        <WalletConnect
          buttonClassName="cta"
          signInLabel="Sign In With Web3 Wallet"
        />
      </span>
      {#if $walletReady}
        <p class="validation">
          Connect your web3 wallet to load Potentials NFTs
        </p>
      {:else}
        <span class="flex-row gap">
          <LoadingSVG />
          <h5>Checking wallet session…</h5>
        </span>
      {/if}
    </div>
  {/if}
</section>

<style lang="scss">
  @use '/src/styles/mixins/' as *;

  section {
    gap: 0;
    min-width: min(40rem, 95%);
    @include auto-width;

    .container {
      width: 100%;
      margin: 0;
      animation: none;
      @include dark-blue;
    }

    header {
      width: 100%;
      z-index: 10;
      background-color: $royal-purple;
      border-top-left-radius: 1rem;
      border-top-right-radius: 1rem;

      h4 {
        @include orange(1, text);
      }

      span {
        width: 100%;
      }

      @include respond-up(tablet) {
        flex-direction: row;
        justify-content: space-between;

        span {
          width: auto;
        }
      }
    }

    .panel {
      width: 100%;
      border-top-left-radius: 0;
      border-top-right-radius: 0;

      .stats {
        width: 100%;

        article {
          display: flex;
          flex-flow: column nowrap;
          align-items: flex-start;
          gap: 0.5rem;
          width: 100%;
          padding: 1rem;
          border-radius: 0.5rem;
          @include white-txt;
          @include gray-border;
          @include purple(0.25);

          p {
            margin-bottom: 0.5rem;
            @include font(caption);
          }

          h4 strong {
            opacity: 0.5;
            font-weight: normal;
            @include font(body);
          }
        }

        @include respond-up(tablet) {
          flex-direction: row;
          align-items: stretch;
        }
      }
    }
  }
</style>
