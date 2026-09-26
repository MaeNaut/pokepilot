import type { Locale } from "../i18n/gameTranslations";

const failureMessages: Record<string, { ko: string; en: string }> = {
  AUTH_REQUIRED: { ko: "로그인이 만료되었습니다. 다시 로그인하시기 바랍니다.", en: "Your session expired. Sign in again." },
  AUTH_UNAVAILABLE: { ko: "로그인 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하시기 바랍니다.", en: "Sign-in is unavailable. Try again shortly." },
  PERSONAL_KEY_REQUIRED: { ko: "PokePilot 분석에는 개인 API 키가 필요합니다. 계정 설정에서 등록할 수 있습니다.", en: "PokePilot analysis requires a personal API key. Add one in account settings." },
  PERSONAL_KEY_INVALID: { ko: "개인 API 키를 사용할 수 없습니다. 계정 설정에서 확인하시기 바랍니다.", en: "Your personal API key could not be used. Check it in account settings." },
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
