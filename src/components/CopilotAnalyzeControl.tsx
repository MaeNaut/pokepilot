import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faRotateRight, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import { useLocalization } from "../i18n/useLocalization";
import type { CopilotAnalysisRequest, CopilotAnalysisScope } from "../utils/copilotContracts";
import { estimateCopilotAnalysis, type CopilotEstimate } from "../utils/copilotEstimate";

type Props = {
  scope: CopilotAnalysisScope;
  request: CopilotAnalysisRequest;
  reasoningEffort: "low" | "medium";
  battleContext?: string;
  isAnalyzeConfirmationOpen: boolean;
  isAnalyzeDisabled: boolean;
  isBusy: boolean;
  isEstimatePreparing?: boolean;
  startedAt?: number;
  hasResponse: boolean;
  hasPersonalApiKey: boolean;
  analyzeLabel: string;
  onRequest: () => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function CopilotAnalyzeControl({
  scope, request, reasoningEffort, battleContext, isAnalyzeConfirmationOpen, isAnalyzeDisabled,
  isBusy, isEstimatePreparing = false, startedAt, hasResponse, hasPersonalApiKey, analyzeLabel, onRequest, onClose, onConfirm,
}: Props) {
  const { t, locale } = useLocalization();
  const [estimateState, setEstimateState] = useState<{
    request: CopilotAnalysisRequest;
    effort: "low" | "medium";
    value: CopilotEstimate | null;
  } | null>(null);
  useEffect(() => {
    if (!isAnalyzeConfirmationOpen) return;
    const controller = new AbortController();
    void estimateCopilotAnalysis(request, reasoningEffort, controller.signal)
      .catch(() => null)
      .then((value) => {
        if (!controller.signal.aborted) setEstimateState({ request, effort: reasoningEffort, value });
      });
    return () => controller.abort();
  }, [isAnalyzeConfirmationOpen, request, reasoningEffort]);
  const activeEstimate = estimateState?.request === request && estimateState.effort === reasoningEffort
    ? estimateState : null;
  const estimate = activeEstimate?.value;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!isBusy || startedAt === undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isBusy, startedAt]);
  const elapsed = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  const timerLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const analyzeControlRef = useRef<HTMLDivElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  const analyzeConfirmationHeadingRef = useRef<HTMLElement>(null);
  const modelChoice = reasoningEffort === "medium" ? "luna-medium" : "luna-low";
  const modelLabel = reasoningEffort === "medium" ? "Luna medium" : "Luna low";
  useDismissOnOutsidePointer(analyzeControlRef, isAnalyzeConfirmationOpen, onClose);
  useEffect(() => {
    onClose();
  }, [scope, modelChoice, onClose]);
  useEffect(() => {
    if (isAnalyzeDisabled) onClose();
  }, [isAnalyzeDisabled, onClose]);
  useEffect(() => {
    if (isAnalyzeConfirmationOpen) analyzeConfirmationHeadingRef.current?.focus();
  }, [isAnalyzeConfirmationOpen]);
  return (
    <div
      className="copilot-analyze-control"
      ref={analyzeControlRef}
      onKeyDown={(event) => {
        if (isAnalyzeConfirmationOpen && event.key === "Escape") {
          event.stopPropagation();
          onClose();
          analyzeButtonRef.current?.focus();
        }
      }}
    >
      <button
        ref={analyzeButtonRef}
        className="copilot-analyze-button"
        type="button"
        disabled={isAnalyzeDisabled}
        aria-label={isBusy ? t("copilot.analyzing") : isEstimatePreparing ? t("copilot.estimateLoading") : undefined}
        aria-busy={isBusy || isEstimatePreparing}
        onClick={onRequest}
        aria-haspopup="dialog"
        aria-expanded={isAnalyzeConfirmationOpen}
        aria-controls={isAnalyzeConfirmationOpen ? "copilot-analyze-confirmation" : undefined}
      >
        <FontAwesomeIcon
          icon={
            isBusy || isEstimatePreparing
              ? faSpinner
              : hasResponse
                ? faRotateRight
                : faWandMagicSparkles
          }
          spin={isBusy || isEstimatePreparing}
          aria-hidden="true"
        />
        {isBusy && startedAt !== undefined
          ? <span className="copilot-analyze-timer" aria-hidden="true">{timerLabel}</span>
          : analyzeLabel}
      </button>
      {isAnalyzeConfirmationOpen ? (
        <div
          className="copilot-analyze-confirmation"
          id="copilot-analyze-confirmation"
          role="dialog"
          aria-label={t("copilot.confirmAnalysis")}
        >
          <strong ref={analyzeConfirmationHeadingRef} tabIndex={-1}>
            {t("copilot.confirmAnalysis")}
          </strong>
          <span className="copilot-analyze-confirmation-model">{modelLabel}</span>
          {battleContext ? <small>{battleContext}</small> : null}
          <div aria-live="polite" aria-busy={!activeEstimate}>
            {estimate
              ? <dl className="copilot-estimate">
                  <dt>{t("copilot.estimateTime")}</dt>
                  <dd>{estimate.seconds.join("–")}{t("copilot.execution.seconds")}</dd>
                  <dt>{t("copilot.estimateTokens")}</dt>
                  <dd>{estimate.totalTokens.map(value =>
                    (Math.ceil(value / 100) * 100).toLocaleString(locale)).join("–")}</dd>
                  <dt>{t("copilot.execution.cost")}</dt>
                  <dd>${estimate.costUsd.map((value, index) =>
                    ((index ? Math.ceil : Math.floor)(value * 10000) / 10000).toFixed(4)).join("–$")}</dd>
                </dl>
              : <p>{t(activeEstimate ? "copilot.estimateUnavailable" : "copilot.estimateLoading")}</p>}
          </div>
          <small>{t(hasPersonalApiKey ? "copilot.estimateNote" : "copilot.estimateNoteSite")}</small>
          <small>{t("copilot.autoSaveNotice")}</small>
          <div className="copilot-analyze-confirmation-actions">
            <button type="button" onClick={() => {
              onClose();
              analyzeButtonRef.current?.focus();
            }}>
              {t("common.cancel")}
            </button>
            <button type="button" disabled={!activeEstimate} onClick={() => void onConfirm()}>
              {t("copilot.startAnalysis")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
