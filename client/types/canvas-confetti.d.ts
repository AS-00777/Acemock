declare module "canvas-confetti" {
  type ConfettiOptions = {
    particleCount?: number;
    spread?: number;
    startVelocity?: number;
    ticks?: number;
    gravity?: number;
    decay?: number;
    scalar?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    disableForReducedMotion?: boolean;
  };

  const confetti: (options?: ConfettiOptions) => Promise<null> | null;

  export default confetti;
}
