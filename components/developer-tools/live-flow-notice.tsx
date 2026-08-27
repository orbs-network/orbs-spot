export type LiveFlowPhase<Step extends string> = {
  effect: string;
  label: string;
  step: Step;
};

export function getLiveFlowPhaseIndex<Step extends string>(
  step: Step,
  phases: readonly LiveFlowPhase<Step>[],
  successStep: Step,
) {
  if (step === successStep) return phases.length;
  return phases.findIndex((phase) => phase.step === step);
}

export function LiveFlowNotice<Step extends string>({
  actualStep,
  flowStep,
  flowSummary,
  flowTitle,
  onSelectPhase,
  phases,
  progressLabel,
  selectablePhaseIndexes,
  successStep,
  successTitle,
  viewedStep,
}: {
  actualStep: Step;
  flowStep: Step;
  flowSummary: string;
  flowTitle: string;
  onSelectPhase: (phaseIndex: number) => void;
  phases: readonly LiveFlowPhase<Step>[];
  progressLabel: string;
  selectablePhaseIndexes: readonly number[];
  successStep: Step;
  successTitle: string;
  viewedStep: Step;
}) {
  const actualPhaseIndex = getLiveFlowPhaseIndex(
    actualStep,
    phases,
    successStep,
  );
  const viewedPhaseIndex = getLiveFlowPhaseIndex(
    viewedStep,
    phases,
    successStep,
  );
  const viewedPhase =
    viewedPhaseIndex >= 0 && viewedPhaseIndex < phases.length
      ? phases[viewedPhaseIndex]
      : undefined;

  return (
    <div className="pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border/80 bg-card/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span className="text-foreground">
          {viewedStep === flowStep
            ? flowTitle
            : viewedStep === successStep
              ? successTitle
              : viewedPhase?.label}
        </span>
        <span className="text-muted-foreground">
          {viewedStep === flowStep
            ? flowSummary
            : viewedStep === successStep
              ? `${phases.length} of ${phases.length} complete`
              : `Step ${viewedPhaseIndex + 1} of ${phases.length} · ${viewedPhase?.effect}`}
        </span>
      </div>
      <div
        className="mt-2 grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))`,
        }}
        aria-label={progressLabel}
      >
        {phases.map((phase, index) => {
          const canSelect = selectablePhaseIndexes.includes(index);

          return (
            <button
              key={phase.step}
              type="button"
              disabled={!canSelect}
              onClick={() => onSelectPhase(index)}
              aria-label={
                canSelect
                  ? `View ${phase.label} step`
                  : `${phase.label} step is not available yet`
              }
              aria-current={index === viewedPhaseIndex ? "step" : undefined}
              className={`rounded-md border px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default ${
                index === viewedPhaseIndex
                  ? "border-primary/40 bg-primary/10"
                  : canSelect
                    ? "border-transparent hover:border-primary/25 hover:bg-primary/[0.06]"
                    : "border-transparent"
              }`}
            >
              <span
                className={`block h-1 rounded-full ${
                  index <= actualPhaseIndex
                    ? "bg-primary"
                    : index === viewedPhaseIndex
                      ? "bg-primary/55"
                      : "bg-secondary"
                }`}
              />
              <span
                className={`mt-1 block truncate text-[9px] ${
                  index === viewedPhaseIndex
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {phase.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
