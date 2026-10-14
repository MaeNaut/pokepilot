import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faRotateRight, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import { useLocalization } from "../i18n/useLocalization";
import type { CopilotAnalysisScope } from "../utils/copilotContracts";

const analysisEstimates: Partial<Record<
  CopilotAnalysisScope,
  Record<"luna-low" | "luna-medium", { seconds: number; cost: string }>
>> = {
  team: { "luna-low": { seconds: 16, cost: "0.0018" }, "luna-medium": { seconds: 75, cost: "0.0048" } },
  pokemon: { "luna-low": { seconds: 10, cost: "0.0015" }, "luna-medium": { seconds: 31, cost: "0.0024" } },
  recommendation: { "luna-low": { seconds: 12, cost: "0.0027" }, "luna-medium": { seconds: 52, cost: "0.0041" } },
};


type Props = {
  scope: CopilotAnalysisScope;
  reasoningEffort: "low" | "medium";
  battleContext?: string;
  isAnalyzeConfirmationOpen: boolean;
  isAnalyzeDisabled: boolean;
  isBusy: boolean;
  startedAt?: number;
  hasResponse: boolean;
  hasPersonalApiKey: boolean;
  analyzeLabel: string;
  onRequest: () => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function CopilotAnalyzeControl({
  scope, reasoningEffort, battleContext, isAnalyzeConfirmationOpen, isAnalyzeDisabled,
  isBusy, startedAt, hasResponse, hasPersonalApiKey, analyzeLabel, onRequest, onClose, onConfirm,
}: Props) {
  const { t } = useLocalization();
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
  }, [scope, modelChoice, isAnalyzeDisabled, onClose]);
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
        aria-label={isBusy ? t("copilot.analyzing") : undefined}
        aria-busy={isBusy}
        onClick={onRequest}
        aria-haspopup="dialog"
        aria-expanded={isAnalyzeConfirmationOpen}
        aria-controls={isAnalyzeConfirmationOpen ? "copilot-analyze-confirmation" : undefined}
      >
        <FontAwesomeIcon
          icon={
            isBusy
              ? faSpinner
              : hasResponse
                ? faRotateRight
                : faWandMagicSparkles
          }
          spin={isBusy}
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
          <p>
            {analysisEstimates[scope]
              ? t(hasPersonalApiKey ? "copilot.estimate" : "copilot.estimateSite", {
                  seconds: analysisEstimates[scope][modelChoice].seconds,
                  cost: analysisEstimates[scope][modelChoice].cost,
                })
              : t("copilot.estimateUnavailable")}
          </p>
          <small>{t(hasPersonalApiKey ? "copilot.estimateNote" : "copilot.estimateNoteSite")}</small>
          <small>{t("copilot.autoSaveNotice")}</small>
          <div className="copilot-analyze-confirmation-actions">
            <button type="button" onClick={() => {
              onClose();
              analyzeButtonRef.current?.focus();
            }}>
              {t("common.cancel")}
            </button>
            <button type="button" onClick={() => void onConfirm()}>
              {t("copilot.startAnalysis")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
