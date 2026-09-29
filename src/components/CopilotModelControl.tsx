import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faLock } from "@fortawesome/free-solid-svg-icons";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import { useLocalization } from "../i18n/useLocalization";

type Props = {
  reasoningEffort: "low" | "medium";
  isPersonalModelAvailable: boolean;
  onChange: (effort: "low" | "medium") => void;
};

export function CopilotModelControl({ reasoningEffort, isPersonalModelAvailable, onChange }: Props) {
  const { locale } = useLocalization();
  const [isReasoningMenuOpen, setIsReasoningMenuOpen] = useState(false);
  const reasoningMenuRef = useRef<HTMLDivElement>(null);
  const modelChoice = reasoningEffort === "medium" ? "luna-medium" : "luna-low";
  const modelLabel = reasoningEffort === "medium" ? "Luna medium" : "Luna low";
  const keyRequiredMessage = locale === "ko" ? "개인 OpenAI API 키가 필요합니다." : "Requires your OpenAI API key.";
  useDismissOnOutsidePointer(reasoningMenuRef, isReasoningMenuOpen, () => {
    setIsReasoningMenuOpen(false);
  });
  useEffect(() => {
    if (!isReasoningMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReasoningMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isReasoningMenuOpen]);

  return (
    <div className="copilot-reasoning-control" ref={reasoningMenuRef}>
      <button
        type="button"
        className="copilot-reasoning-trigger"
        aria-label={`${locale === "ko" ? "모델" : "Model"}: ${modelLabel}`}
        aria-expanded={isReasoningMenuOpen}
        aria-haspopup="menu"
        onClick={() => setIsReasoningMenuOpen((open) => !open)}
      >
        <span>GPT 6</span>
        <span className="copilot-reasoning-current">{modelLabel}</span>
        <FontAwesomeIcon icon={isReasoningMenuOpen ? faChevronDown : faChevronUp} aria-hidden="true" />
      </button>
      {isReasoningMenuOpen ? (
        <div className="copilot-reasoning-menu" role="menu" aria-label={locale === "ko" ? "모델" : "Model"}>
          <strong>{locale === "ko" ? "모델" : "Model"}</strong>
          {([
            { choice: "luna-medium", label: "Luna medium", id: "gpt-6-luna", effort: "medium", requiresKey: true },
            { choice: "luna-low", label: "Luna low", id: "gpt-6-luna", effort: "low", requiresKey: true },
          ] as const).map((option) => {
            const locked = option.requiresKey && !isPersonalModelAvailable;
            const comparison = option.choice === "luna-low"
              ? locale === "ko" ? "기본 모델" : "Default model"
              : locale === "ko"
                ? "더 깊은 추론 · 시간·비용 증가"
                : "Deeper reasoning · More time and cost";
            return (
              <div className="copilot-reasoning-option" key={option.choice} tabIndex={locked ? 0 : undefined} aria-describedby={locked ? `copilot-${option.choice}-lock` : undefined}>
                <button type="button" role="menuitemradio" aria-checked={modelChoice === option.choice} className={modelChoice === option.choice ? "is-active" : ""} disabled={locked} onClick={() => { onChange(option.effort); setIsReasoningMenuOpen(false); }}>
                  <span className="copilot-reasoning-option-copy">
                    <span>{option.label}</span>
                    <small>{comparison}</small>
                  </span>
                  {locked ? <FontAwesomeIcon icon={faLock} aria-hidden="true" /> : null}
                </button>
                {locked ? <span className="copilot-reasoning-lock-popover" id={`copilot-${option.choice}-lock`} role="tooltip">{keyRequiredMessage}</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
