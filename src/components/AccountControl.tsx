import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import type { useAccount } from "../hooks/useAccount";
import { useLocalization } from "../i18n/useLocalization";
import "./accountControl.css";

export function AccountControl({ account }: { account: ReturnType<typeof useAccount> }) {
  const { locale } = useLocalization();
  const ko = locale === "ko";
  if (!account.enabled) return null;
  return <details className="account-control" open={account.prompt || account.status === "error" || undefined}>
    <summary><FontAwesomeIcon icon={faUser} /> {ko ? "계정" : "Account"}</summary>
    <div className="account-actions">
      {account.status === "loading" && <p role="status">{ko ? "로그인 확인 중…" : "Checking sign-in…"}</p>}
      {account.status === "error" && <p role="alert">{ko ? "계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." : "Unable to verify your account. Please try again."}</p>}
      {account.status !== "ready" ? <button type="button" disabled={account.busy || account.status === "loading"} onClick={() => void account.act("login")}>
        {ko ? "Google로 로그인" : "Sign in with Google"}
      </button> : <>
        <button type="button" disabled={account.busy} onClick={() => void account.act("logout")}>{ko ? "로그아웃" : "Sign out"}</button>
        <button type="button" disabled={account.busy} onClick={() => {
          if (window.confirm(ko ? "계정을 삭제할까요? 이 브라우저의 팀과 분석 기록은 유지됩니다." : "Delete your account? Teams and analysis history in this browser will be kept.")) void account.act("delete");
        }}>{ko ? "계정 삭제" : "Delete account"}</button>
      </>}
      {account.prompt && account.status === "guest" && <p>{ko ? "AI 분석을 이용하려면 로그인해 주세요." : "Sign in to use AI analysis."}</p>}
    </div>
  </details>;
}
