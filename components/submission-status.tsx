import type { ReactNode } from "react";
import { AlertTriangleIcon, ArrowDownUpIcon, ArrowRightIcon, CheckIcon, ExternalLinkIcon, FilePenLineIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { formatSubmissionError } from "@/lib/submission-error";
import styles from "./submission-status.module.css";

export type SubmissionStep = {
  id: string;
  action: "wrap" | "approve" | "sign";
  title: string;
  transactionHash?: string;
  transactionUrl?: string;
};

const STEP_ICONS = { wrap: ArrowDownUpIcon, approve: ShieldCheckIcon, sign: FilePenLineIcon };

// Orders and swaps supply their own step plan; presentation stays identical.
export function SubmissionSteps({ steps, activeStep, instruction }: {
  steps: SubmissionStep[];
  activeStep: number;
  instruction?: string;
}) {
  if (!steps.length) return null;
  return <ol data-submission-steps aria-label="Submission steps" className={styles.stepper}>
    {steps.map((step, index) => {
      const state = index < activeStep ? "completed"
        : index === activeStep ? "active" : "upcoming";
      const stateLabel = state === "completed" ? "Done" : state === "active" ? "Active" : "Upcoming";
      const Icon = STEP_ICONS[step.action];
      return <li key={step.id} data-submission-step={step.id} data-state={state} aria-current={state === "active" ? "step" : undefined} className={styles.step}>
        <span data-submission-step-icon aria-hidden="true" className={styles.stepMarker}>
          {state === "active" ? <Icon className="size-3.5" strokeWidth={1.8} />
            : state === "completed" ? <CheckIcon className="size-3.5" strokeWidth={2} />
            : <span className={styles.stepDot} />}
        </span>
        <div className={styles.stepCopy}>
          <h3 className={styles.stepTitle}>{step.title}</h3>
          <p data-submission-detail className={styles.stepInstruction}>
            {step.transactionHash ? step.transactionUrl ? <a data-submission-transaction href={step.transactionUrl} target="_blank" rel="noopener noreferrer" title={step.transactionHash} aria-label={`View ${step.title} transaction ${step.transactionHash}`} className={styles.stepLink}>
              Transaction hash<ExternalLinkIcon aria-hidden="true" className="size-3" />
            </a> : <span data-submission-transaction title={step.transactionHash}>Transaction hash</span>
              : state === "active" ? instruction : null}
          </p>
        </div>
        <span className="sr-only">{stateLabel}</span>
        <span data-submission-step-counter data-hidden={state !== "active" || undefined} aria-hidden={state !== "active" || undefined} className={styles.stepCounter}>
          {state === "active" && <Spinner data-submission-loader aria-hidden="true" role="presentation" className="size-4 motion-reduce:animate-none" />}
          {steps.length > 1 && <>Step {index + 1} of {steps.length}</>}
        </span>
      </li>;
    })}
  </ol>;
}

export function SubmissionOutcome({ outcome, title, message }: {
  outcome: "success" | "error";
  title: string;
  message?: string;
}) {
  const Icon = outcome === "success" ? CheckIcon : AlertTriangleIcon;
  return <div data-submission-outcome={outcome} className={styles.outcome}>
    <span aria-hidden="true" className={styles.outcomeIcon}><Icon className="size-5" strokeWidth={1.8} /></span>
    <div className={styles.outcomeContent}><h3 className={styles.outcomeTitle}>{title}</h3></div>
    {outcome === "error" && <p data-submission-error className={styles.outcomeMessage}>{formatSubmissionError(message)}</p>}
  </div>;
}

// Keep the terminal layout identical; each integration supplies its own summary and link.
export function SubmissionSuccess({ summary, message, onClose, children }: {
  summary?: { input: string; output: string };
  message: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return <div data-submission-success className="flex flex-col gap-3">
    <section role="status" aria-live="polite" aria-atomic="true" className={styles.success}>
      <span aria-hidden="true" className={styles.successIcon}><CheckIcon className="size-6" strokeWidth={1.8} /></span>
      {summary && <p data-submission-success-summary aria-label="Trade summary" className={styles.successSummary}>
        <span>{summary.input}</span>
        <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="sr-only">to</span>
        <span>{summary.output}</span>
      </p>}
      <p className={styles.successConfirmation}>{message}</p>
    </section>
    <Button className="h-12 w-full rounded-[14px] text-base" onClick={onClose}>Done</Button>
    {children && <div className={styles.successLink}>{children}</div>}
  </div>;
}
