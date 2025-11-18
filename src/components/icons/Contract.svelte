<script lang="ts">
  let {
    onclick = () => {},
    text = 'Approve',
    disabled = false,
  }: {
    onclick: () => void;
    text?: string;
    disabled?: boolean;
  } = $props();
</script>

<button class="green-btn" {onclick} aria-label="Refresh" {disabled}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-100 -100 200 200"
    stroke-width="7.5"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-label="Delegations"
  >
    <g id="paper">
      <path
        d="M -10 75 L -85 75 L -85 -85 L 45 -85 L 45 -15"
        fill="none"
        stroke-width="12"
      />
      <circle r="35" cx="-20" cy="-30" fill="none" />
      <path d="M -40 -30 L -25 -15 L 0 -40" fill="none" />
      <path d="M -65 25 L -15 25 M -65 45 L -25 45" />
    </g>
    <g id="stamp">
      <g transform="rotate(45) translate(40 -30)">
        <ellipse rx="35" ry="10" cx="15" cy="60" fill="none" />
        <path
          d="
            M -20 60
            L -20 35
            Q 15 20 50 35
            L 50 60
            M 0 27
            Q 10 10 0 -10
            C -15 -50 45 -50 30 -10
            Q 20 10 30 27
          "
          fill="none"
        />
      </g>
    </g>
  </svg>
  {text}
</button>

<style lang="scss">
  @use '/src/styles/mixins' as *;

  button {
    fill: currentColor;
    stroke: currentColor;

    &:hover:not(:disabled) {
      #paper {
        opacity: 0.5;
      }

      #stamp {
        transform: scale(1.1) translate(-5%, -2.5%);
      }
    }
  }
</style>
