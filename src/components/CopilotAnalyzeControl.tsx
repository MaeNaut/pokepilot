import { useEffect, useRef } from "react";
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
  isAnalyzeConfirmationOpen: boolean;
  isAnalyzeDisabled: boolean;
  isBusy: boolean;
  hasResponse: boolean;
  hasPersonalApiKey: boolean;
  analyzeLabel: string;
  onRequest: () => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function CopilotAnalyzeControl({
  scope, reasoningEffort, isAnalyzeConfirmationOpen, isAnalyzeDisabled,
  isBusy, hasResponse, hasPersonalApiKey, analyzeLabel, onRequest, onClose, onConfirm,
}: Props) {
  const { t } = useLocalization();
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
        {analyzeLabel}
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
