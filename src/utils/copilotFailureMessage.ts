import type { Locale } from "../i18n/gameTranslations";

const failureMessages: Record<string, { ko: string; en: string }> = {
  AUTH_REQUIRED: { ko: "로그인이 만료되었습니다. 다시 로그인하시기 바랍니다.", en: "Your session expired. Sign in again." },
  AUTH_UNAVAILABLE: { ko: "로그인 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하시기 바랍니다.", en: "Sign-in is unavailable. Try again shortly." },
  PERSONAL_KEY_REQUIRED: { ko: "PokePilot 분석에는 개인 API 키가 필요합니다. 계정 설정에서 등록할 수 있습니다.", en: "PokePilot analysis requires a personal API key. Add one in account settings." },
  PERSONAL_KEY_INVALID: { ko: "OpenAI에서 개인 API 키를 인증하지 못했습니다. 키의 만료·폐기 여부와 프로젝트를 확인하고, 필요한 경우 프로필에서 키를 삭제한 뒤 다시 등록하시기 바랍니다.", en: "OpenAI could not authenticate your API key. Check its expiry, revocation status, and project. If needed, remove and re-register it in your profile." },
  PERSONAL_KEY_FORBIDDEN: { ko: "OpenAI에서 접근을 거부했습니다. 키의 Responses Write 권한과 프로젝트·조직의 접근 제한을 확인하시기 바랍니다.", en: "OpenAI denied access. Check Responses Write permission and project or organization access restrictions." },
  AI_QUOTA_EXCEEDED: { ko: "OpenAI 잔액·결제 상태 또는 사용 한도로 분석이 거부되었습니다. Billing과 Limits를 확인하시기 바랍니다. 기다리거나 재시도하는 것만으로는 해결되지 않을 수 있습니다.", en: "OpenAI rejected analysis due to billing, credits, or a usage limit. Check Billing and Limits. Waiting or retrying alone may not resolve this." },
  AI_MODEL_UNAVAILABLE: { ko: "선택한 모델이 존재하지 않거나 현재 OpenAI 프로젝트에서 접근할 수 없습니다. 다른 모델을 선택하거나 프로젝트의 모델 접근 권한을 확인하시기 바랍니다.", en: "The selected model is unavailable or inaccessible to your OpenAI project. Select another model or check project model access." },
  AI_RATE_LIMITED: { ko: "AI 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도하시기 바랍니다.", en: "AI requests are temporarily limited. Try again shortly." },
  AI_NOT_CONFIGURED: { ko: "AI 분석이 설정되지 않았습니다.", en: "AI analysis is not configured." },
  INVALID_REQUEST: { ko: "분석 요청에 필요한 정보가 올바르지 않습니다.", en: "The analysis request contains invalid data." },
  INVALID_JSON: { ko: "분석 요청을 읽을 수 없습니다.", en: "The analysis request could not be read." },
  PAYLOAD_TOO_LARGE: { ko: "분석 요청이 너무 큽니다.", en: "The analysis request is too large." },
  NETWORK_ERROR: { ko: "AI 서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도하시기 바랍니다.", en: "Could not reach the AI server. Check your connection and try again." },
  AI_INVALID_RESPONSE: { ko: "AI 응답을 분석 결과로 표시할 수 없습니다. 다시 시도하시기 바랍니다.", en: "The AI response could not be displayed as an analysis. Try again." },
  INVALID_RESPONSE: { ko: "AI 응답을 읽거나 표시할 수 없습니다. 다시 시도하시기 바랍니다.", en: "The AI response could not be read or displayed. Try again." },
  AI_UPSTREAM_ERROR: { ko: "AI 서비스에서 분석을 완료하지 못했습니다. 다시 시도하시기 바랍니다.", en: "The AI service could not complete the analysis. Try again." },
};

export function getCopilotFailureMessage(code: string | undefined, locale: Locale, fallback: string) {
  return code && failureMessages[code] ? failureMessages[code][locale] : fallback;
}

export function getCopilotNoCostMessage(locale: Locale) {
  return locale === "ko"
    ? "AI 호출이 시작되지 않아 분석 비용이 발생하지 않았습니다."
    : "The AI call did not start, so no analysis cost was incurred.";
}
