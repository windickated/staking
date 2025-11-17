<script lang="ts">
  import WalletConnect from '@components/web3/WalletConnect.svelte';
  import Logo from '@components/icons/Logo.svelte';

  const clamp = 64; // px after which hiding can kick in

  let header: HTMLElement;

  let hiddenHeader = $state<boolean>(false);

  // Throttle scroll work to animation frames to avoid layout thrash
  let lastY = 0;
  let ticking = false;
  const onscroll = () => {
    const y = window.scrollY;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (y > lastY && y > clamp) header.classList.add('hide');
      else if (y < lastY) header.classList.remove('hide');
      lastY = y;
      ticking = false;
    });
  };
</script>

<svelte:window {onscroll} />

<nav class="flex-row" class:hide={hiddenHeader} bind:this={header}>
  <div class="flex-row">
    <Logo />
    <a
      class="nohover-link fle pc-only"
      href="https://conexus.degenerousdao.com/"
    >
      CoNexus
    </a>
    <a
      class="nohover-link flex pc-only"
      href="https://governance.dgrslabs.ink/"
    >
      Governance Hub
    </a>
  </div>

  <WalletConnect />
</nav>

<style lang="scss">
  @use '/src/styles/mixins/' as *;

  nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 1rem;
    justify-content: space-between;
    z-index: 100;
    transition: transform 0.3s ease-in-out;
    will-change: transform;
    @include dark-blue;
    @include box-shadow;

    &.hide {
      transform: translateY(-100%);
    }

    a {
      font-weight: 500;
      text-transform: capitalize;
      @include white-txt;

      &:hover,
      &:active,
      &:focus {
        @include cyan(1, text);
      }
    }
  }
</style>
