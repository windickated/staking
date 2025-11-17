<script lang="ts">
  import type { Action } from 'svelte/action';

  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';

  import Rainbow from '@components/web3/Rainbow.tsx';

  let {
    buttonClassName,
    signInLabel,
  }: {
    buttonClassName?: string;
    signInLabel?: string;
  } = $props();

  // Rainbow button (React) Mount helper used when wallet isn't connected yet.
  const mountRainbow: Action<HTMLDivElement> = (node) => {
    const root = createRoot(node);
    root.render(
      createElement(Rainbow, {
        buttonClassName,
        signInLabel,
      }),
    );
    return {
      destroy() {
        root.unmount();
      },
    };
  };
</script>

<div class="rainbow-slot" use:mountRainbow>
  <button class:rainbow-btn={!buttonClassName} disabled> Loading... </button>
</div>
