let armed = false;

export function armReadPlanFlowAutoplay(): void {
  armed = true;
}

export function consumeReadPlanFlowAutoplay(): boolean {
  const v = armed;
  armed = false;
  return v;
}
