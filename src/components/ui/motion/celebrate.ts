import confetti from "canvas-confetti";

const BRAND_COLORS = ["#F87116", "#FFB37A", "#FACC15", "#22C55E", "#38BDF8", "#F472B6"];

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Confetti burst from an element (or the viewport centre). `size` picks a small pop for
 * routine wins and a bigger burst for milestones. No-op under reduced motion.
 */
export function celebrate(origin?: Element | null, size: "small" | "large" = "small"): void {
  if (prefersReducedMotion()) return;
  let x = 0.5;
  let y = 0.5;
  if (origin) {
    const rect = origin.getBoundingClientRect();
    x = (rect.left + rect.width / 2) / window.innerWidth;
    y = (rect.top + rect.height / 2) / window.innerHeight;
  }
  const large = size === "large";
  void confetti({
    particleCount: large ? 140 : 60,
    spread: large ? 100 : 70,
    startVelocity: large ? 45 : 30,
    scalar: large ? 1 : 0.8,
    ticks: large ? 220 : 140,
    origin: { x, y },
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
    zIndex: 200,
  });
}
