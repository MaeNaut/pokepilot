import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronLeft,
  faCircleQuestion,
  faDesktop,
  faLanguage,
  faKey,
  faMoon,
  faRightFromBracket,
  faRotateRight,
  faSun,
  faTrashCan,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import type { Locale } from "../i18n/gameTranslations";
import { useLocalization } from "../i18n/useLocalization";
import type { ThemePreference } from "../theme/theme";
import type { useAccount } from "../hooks/useAccount";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import {
  getAccountCollectionSyncSnapshot,
  hasPendingAccountCollectionSync,
  retryAccountCollections,
  subscribeAccountCollectionSync,
} from "../utils/accountCollectionSyncStatus";
import {
  hasPendingCollectionForAccount, pendingCopilotHistoryStorageKey,
  pendingTeamsStorageKey,
} from "../utils/accountPendingStorage";
import { getAllPendingAccountPreferences } from "../utils/accountPreferences";
import "./headerAccountMenu.css";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { ACCOUNT_REFRESH_EVENT, readAccountEvent } from "../utils/accountCrossTab";
import { TouchSelectionDialog } from "./TouchSelectionDialog";

type HeaderAccountMenuProps = {
  account: ReturnType<typeof useAccount>;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
};

function getAvatarInitial(account: ReturnType<typeof useAccount>) {
  const value = account.user?.name ?? account.user?.email;
  return value?.trim().charAt(0).toLocaleUpperCase();
}

function AccountAvatar({
  account,
  compact = false,
}: {
  account: ReturnType<typeof useAccount>;
  compact?: boolean;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const pictureUrl = account.user?.pictureUrl;
  const initial = getAvatarInitial(account);

  useEffect(() => {
    setHasImageError(false);
  }, [pictureUrl]);

  return (
    <span className={`header-account-avatar${compact ? " is-compact" : ""}`}>
      {pictureUrl && !hasImageError ? (
        <img
          src={pictureUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setHasImageError(true)}
        />
      ) : initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <FontAwesomeIcon icon={faUser} aria-hidden="true" />
      )}
    </span>
  );
}

export function HeaderAccountMenu({
  account,
  locale,
  onLocaleChange,
  themePreference,
  onThemePreferenceChange,
}: HeaderAccountMenuProps) {
  const { t } = useLocalization();
  const isTouchLayout = useMediaQuery("(max-width: 1420px)");
  const [isOpen, setIsOpen] = useState(false);
  const [submenu, setSubmenu] = useState<{
    kind: "theme" | "language"; left: number; top: number;
  } | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const settingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState<{ accountId: string; value: string } | null>(null);
  const [keyMessage, setKeyMessage] = useState<"saved" | "removed" | "error" | null>(null);
  const keyGeneration = useRef(0);
  const keyContext = `${account.status}:${account.user?.id ?? ""}:${isOpen}`;
  const keyContextRef = useRef(keyContext);
  if (keyContextRef.current !== keyContext) {
    keyContextRef.current = keyContext;
    keyGeneration.current += 1;
  }
  const apiKeyValue = account.status === "ready" && apiKeyDraft && apiKeyDraft.accountId === account.user?.id
    ? apiKeyDraft.value : "";
  const keyGenerationAtRender = keyGeneration.current;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const syncSnapshot = useSyncExternalStore(
    subscribeAccountCollectionSync,
    getAccountCollectionSyncSnapshot,
  );
  const hasSyncIssue = Number(syncSnapshot.split(":")[0]) > 0;

  useDismissOnOutsidePointer(menuRef, isOpen && !(isTouchLayout && submenu), () => { setIsOpen(false); setSubmenu(null); });

  useEffect(() => {
    setApiKeyDraft(null);
    setKeyMessage(null);
  }, [keyContext]);

  const clearPersonalKeyDraft = useCallback(() => {
    keyGeneration.current += 1;
    setApiKeyDraft(null);
    setKeyMessage(null);
  }, []);

  useEffect(() => {
    const onAuthenticationChange = (event: StorageEvent) => {
      if (readAccountEvent(event)?.kind === "auth") clearPersonalKeyDraft();
    };
    window.addEventListener("storage", onAuthenticationChange);
    window.addEventListener(ACCOUNT_REFRESH_EVENT, clearPersonalKeyDraft);
    return () => {
      window.removeEventListener("storage", onAuthenticationChange);
      window.removeEventListener(ACCOUNT_REFRESH_EVENT, clearPersonalKeyDraft);
    };
  }, [clearPersonalKeyDraft]);

  function toggleSubmenu(kind: "theme" | "language", trigger: HTMLButtonElement) {
    if (submenu?.kind === kind) { setSubmenu(null); return; }
    const root = menuRef.current!.getBoundingClientRect();
    const panel = menuRef.current!.querySelector(".header-account-popover")!.getBoundingClientRect();
    const row = trigger.getBoundingClientRect();
    settingTriggerRef.current = trigger;
    setSubmenu({ kind,
      left: Math.max(8, panel.left - 176) - root.left,
      top: Math.max(8, Math.min(row.top, window.innerHeight - (kind === "theme" ? 160 : 116))) - root.top,
    });
  }

  function closeSubmenu() {
    setSubmenu(null);
    settingTriggerRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (submenu && !isTouchLayout) submenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [submenu, isTouchLayout]);
  useEffect(() => {
    const close = () => setSubmenu(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (submenu) { if (!isTouchLayout) closeSubmenu(); return; }
      setIsOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submenu, isTouchLayout]);

  const accountName = account.user?.name ?? account.user?.email ?? t("account.guest");

  async function handleSavePersonalKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (account.status !== "ready" || account.busy || !apiKeyValue.trim() ||
        keyGeneration.current !== keyGenerationAtRender) return;
    const generation = keyGeneration.current;
    const saved = await account.updatePersonalApiKey(apiKeyValue);
    if (keyGeneration.current !== generation) return;
    setApiKeyDraft(null);
    setKeyMessage(saved ? "saved" : "error");
  }

  async function handleRemovePersonalKey() {
    if (account.status !== "ready" || account.busy || keyGeneration.current !== keyGenerationAtRender) return;
    const generation = keyGeneration.current;
    const removed = await account.updatePersonalApiKey(null);
    if (keyGeneration.current !== generation) return;
    setApiKeyDraft(null);
    setKeyMessage(removed ? "removed" : "error");
  }

  const settingOptions = submenu?.kind === "theme" ? ([
    ["system", "account.themeSystem", faDesktop], ["light", "theme.light", faSun], ["dark", "theme.dark", faMoon],
  ] as const).map(([value, label, icon]) => (
    <button type="button" key={value} role="menuitemradio" aria-checked={themePreference === value}
      onClick={() => { onThemePreferenceChange(value); closeSubmenu(); }}>
      <FontAwesomeIcon icon={icon} aria-hidden="true" /><span>{t(label)}</span>
      {themePreference === value ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> : null}
    </button>
  )) : ([ ["en", "language.english"], ["ko", "language.korean"] ] as const).map(([value, label]) => (
    <button type="button" key={value} lang={value} role="menuitemradio" aria-checked={locale === value}
      onClick={() => { onLocaleChange(value); closeSubmenu(); }}>
      <span>{t(label)}</span>{locale === value ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> : null}
    </button>
  ));

  return (
    <div className="header-account-menu" ref={menuRef}>
      <a className="header-account-trigger header-help-link" href={`/help/${locale}.html`}
        aria-label={locale === "ko" ? "도움말" : "Help"} title={locale === "ko" ? "도움말" : "Help"}>
        <FontAwesomeIcon icon={faCircleQuestion} aria-hidden="true" />
      </a>
      <button
        className={`header-account-trigger${isOpen ? " is-open" : ""}${hasSyncIssue ? " has-sync-issue" : ""}`}
        type="button"
        aria-label={hasSyncIssue ? `${t("account.menu")}: ${t("account.syncIssue")}` : t("account.menu")}
        title={hasSyncIssue ? t("account.syncIssue") : t("account.menu")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        ref={triggerRef}
        onClick={() => { setIsOpen((open) => !open); setSubmenu(null); }}
      >
        <AccountAvatar account={account} />
      </button>

      {isOpen ? (
        <div className="header-account-popover" role="dialog" aria-label={t("account.menu")}
          onScroll={() => setSubmenu(null)}>
          {account.enabled ? (
            <section className="header-account-section" aria-label={t("account.label")}>
              {account.status === "ready" ? (
                <div className="header-account-profile">
                  <AccountAvatar account={account} compact />
                  <div>
                    <strong>{accountName}</strong>
                    {account.user?.email && account.user.name ? <span>{account.user.email}</span> : null}
                  </div>
                  <span className="header-account-status">{t("account.signedIn")}</span>
                </div>
              ) : (
                <div className="header-account-copy">
                  <strong>{t("account.label")}</strong>
                  <span>
                    {account.status === "loading"
                      ? t("account.checking")
                      : account.status === "error"
                        ? t("account.unavailable")
                        : account.prompt
                          ? t("account.loginRequired")
                          : t("account.signInDescription")}
                  </span>
                </div>
              )}

              <div className="header-account-actions">
                {account.status === "ready" ? (
                  <>
                    <button
                      type="button"
                      disabled={account.busy}
                      onClick={() => {
                        const accountId = account.user?.id;
                        const pendingInAnotherTab = accountId && (
                          hasPendingCollectionForAccount(pendingTeamsStorageKey, accountId) ||
                          hasPendingCollectionForAccount(pendingCopilotHistoryStorageKey, accountId) ||
                          getAllPendingAccountPreferences().some((record) => record.accountId === accountId)
                        );
                        if ((hasPendingAccountCollectionSync() || pendingInAnotherTab) &&
                            !window.confirm(t("account.unsyncedSignOutConfirm"))) return;
                        clearPersonalKeyDraft();
                        void account.act("logout");
                      }}
                    >
                      <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
                      {t("account.signOut")}
                    </button>
                    <button
                      className="is-danger"
                      type="button"
                      disabled={account.busy}
                      onClick={() => {
                        if (window.confirm(t("account.deleteConfirm"))) {
                          clearPersonalKeyDraft();
                          void account.act("delete");
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                      {t("account.delete")}
                    </button>
                  </>
                ) : (
                  <button
                    className="is-primary"
                    type="button"
                    disabled={account.busy || account.status === "loading"}
                    onClick={() => void account.act("login")}
                  >
                    <FontAwesomeIcon icon={faUser} aria-hidden="true" />
                    {t("account.signIn")}
                  </button>
                )}
              </div>
              {account.status === "ready" && hasSyncIssue ? (
                <div className="header-account-sync-warning" role="status">
                  <span>{t("account.syncIssue")}</span>
                  <button type="button" disabled={account.busy} onClick={() => void retryAccountCollections()}>
                    <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
                    {t("account.syncRetry")}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {account.status === "ready" ? (
            <section className="header-account-section" aria-label={t("account.apiKeyLabel")}>
              <div className="header-account-setting-label">
                <FontAwesomeIcon icon={faKey} aria-hidden="true" />
                <span>{t("account.apiKeyLabel")}</span>
              </div>
              <p className="header-account-key-note">{t("account.apiKeyDescription")}</p>
              <a className="header-account-key-note" href={`/help/api-key-${locale}.html`} target="_blank" rel="noopener noreferrer">
                {locale === "ko" ? "API 키 발급 가이드 (새 탭)" : "API key setup guide (new tab)"}
              </a>
              {account.personalApiKeyStatus !== "ready" || account.hasPersonalApiKey ? <span className="header-account-key-status">
                {account.personalApiKeyStatus === "loading"
                  ? t("account.apiKeyChecking")
                  : account.personalApiKeyStatus === "error"
                    ? t("account.apiKeyError")
                    : account.hasPersonalApiKey
                      ? t("account.apiKeySaved")
                      : null}
              </span> : null}
              {!account.hasPersonalApiKey && account.personalApiKeyStatus === "ready" ? <form className="header-account-key-form" onSubmit={(event) => void handleSavePersonalKey(event)}>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={account.busy}
                  aria-label={t("account.apiKeyLabel")}
                  placeholder="sk-..."
                  value={apiKeyValue}
                  onChange={(event) => {
                    if (account.status !== "ready" || !account.user) return;
                    keyGeneration.current += 1;
                    setApiKeyDraft({ accountId: account.user.id, value: event.target.value });
                    setKeyMessage(null);
                  }}
                />
                <button type="submit" disabled={account.busy || !apiKeyValue.trim()}>{t("account.apiKeySave")}</button>
              </form> : null}
              {account.hasPersonalApiKey ? (
                <button className="header-account-key-remove" type="button" disabled={account.busy} onClick={() => void handleRemovePersonalKey()}>
                  <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                  {t("account.apiKeyRemove")}
                </button>
              ) : null}
              {keyMessage && keyMessage !== "saved" ? <span className="header-account-key-status" role="status">{t(`account.apiKey${keyMessage === "removed" ? "Removed" : "Error"}`)}</span> : null}
            </section>
          ) : null}

          <section className="header-account-section" aria-label={t("theme.label")}>
            <button className="header-account-setting-trigger" type="button"
              aria-label={t("theme.label")} aria-haspopup={isTouchLayout ? "dialog" : "menu"} aria-expanded={submenu?.kind === "theme"}
              onClick={(event) => toggleSubmenu("theme", event.currentTarget)}
              onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); toggleSubmenu("theme", event.currentTarget); } }}>
              {!isTouchLayout ? <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" /> : null}
              <FontAwesomeIcon icon={
                themePreference === "system"
                  ? faDesktop
                  : themePreference === "dark"
                    ? faMoon
                    : faSun
              } aria-hidden="true" />
              <span>{t("theme.label")}</span>
              <small>{t(themePreference === "system" ? "account.themeSystem" : themePreference === "dark" ? "theme.dark" : "theme.light")}</small>
            </button>
          </section>

          <section className="header-account-section" aria-label={t("language.label")}>
            <button className="header-account-setting-trigger" type="button"
              aria-label={t("language.label")} aria-haspopup={isTouchLayout ? "dialog" : "menu"} aria-expanded={submenu?.kind === "language"}
              onClick={(event) => toggleSubmenu("language", event.currentTarget)}
              onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); toggleSubmenu("language", event.currentTarget); } }}>
              {!isTouchLayout ? <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" /> : null}
              <FontAwesomeIcon icon={faLanguage} aria-hidden="true" />
              <span>{t("language.label")}</span>
              <small>{t(locale === "ko" ? "language.korean" : "language.english")}</small>
            </button>
          </section>
        </div>
      ) : null}
      {isOpen && submenu && isTouchLayout ? (
        <TouchSelectionDialog kind="settings" title={t(submenu.kind === "theme" ? "theme.label" : "language.label")}
          showActions={false} onClose={closeSubmenu}>
          <div className="header-account-settings-options" role="menu"
            aria-label={t(submenu.kind === "theme" ? "theme.label" : "language.label")}>
            {settingOptions}
          </div>
        </TouchSelectionDialog>
      ) : isOpen && submenu ? (
        <div className="header-account-submenu" ref={submenuRef} role="menu"
          aria-label={t(submenu.kind === "theme" ? "theme.label" : "language.label")}
          style={{ left: submenu.left, top: submenu.top }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); closeSubmenu(); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
              const index = items.indexOf(document.activeElement as HTMLButtonElement);
              items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
            }
          }}>
          {settingOptions}
        </div>
      ) : null}
    </div>
  );
}
