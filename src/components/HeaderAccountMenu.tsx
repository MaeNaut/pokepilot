import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faDesktop,
  faLanguage,
  faKey,
  faMoon,
  faRightFromBracket,
  faSun,
  faTrashCan,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import type { Locale } from "../i18n/gameTranslations";
import { useLocalization } from "../i18n/useLocalization";
import type { ThemePreference } from "../theme/theme";
import type { useAccount } from "../hooks/useAccount";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import "./headerAccountMenu.css";

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
  const [isOpen, setIsOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [keyMessage, setKeyMessage] = useState<"saved" | "removed" | "error" | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useDismissOnOutsidePointer(menuRef, isOpen, () => setIsOpen(false));

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const accountName = account.user?.name ?? account.user?.email ?? t("account.guest");

  async function handleSavePersonalKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await account.updatePersonalApiKey(apiKeyDraft);
    setApiKeyDraft("");
    setKeyMessage(saved ? "saved" : "error");
  }

  async function handleRemovePersonalKey() {
    const removed = await account.updatePersonalApiKey(null);
    setApiKeyDraft("");
    setKeyMessage(removed ? "removed" : "error");
  }

  return (
    <div className="header-account-menu" ref={menuRef}>
      <button
        className={`header-account-trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-label={t("account.menu")}
        title={t("account.menu")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
      >
        <AccountAvatar account={account} />
      </button>

      {isOpen ? (
        <div className="header-account-popover" role="dialog" aria-label={t("account.menu")}>
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
                      onClick={() => void account.act("logout")}
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
            </section>
          ) : null}

          {account.status === "ready" ? (
            <section className="header-account-section" aria-label={t("account.apiKeyLabel")}>
              <div className="header-account-setting-label">
                <FontAwesomeIcon icon={faKey} aria-hidden="true" />
                <span>{t("account.apiKeyLabel")}</span>
              </div>
              <p className="header-account-key-note">{t("account.apiKeyDescription")}</p>
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
                  aria-label={t("account.apiKeyLabel")}
                  placeholder="sk-..."
                  value={apiKeyDraft}
                  onChange={(event) => { setApiKeyDraft(event.target.value); setKeyMessage(null); }}
                />
                <button type="submit" disabled={account.busy || !apiKeyDraft.trim()}>{t("account.apiKeySave")}</button>
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
            <div className="header-account-setting-label">
              <FontAwesomeIcon icon={
                themePreference === "system"
                  ? faDesktop
                  : themePreference === "dark"
                    ? faMoon
                    : faSun
              } aria-hidden="true" />
              <span>{t("theme.label")}</span>
            </div>
            <div className="header-account-choice-group" role="group" aria-label={t("theme.label")}>
              {([
                ["system", "account.themeSystem", faDesktop],
                ["light", "theme.light", faSun],
                ["dark", "theme.dark", faMoon],
              ] as const).map(([value, labelKey, icon]) => (
                <button
                  className={themePreference === value ? "is-active" : ""}
                  type="button"
                  aria-pressed={themePreference === value}
                  key={value}
                  onClick={() => onThemePreferenceChange(value)}
                >
                  <FontAwesomeIcon icon={icon} aria-hidden="true" />
                  <span>{t(labelKey)}</span>
                  {themePreference === value ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="header-account-section" aria-label={t("language.label")}>
            <div className="header-account-setting-label">
              <FontAwesomeIcon icon={faLanguage} aria-hidden="true" />
              <span>{t("language.label")}</span>
            </div>
            <div className="header-account-choice-group" role="group" aria-label={t("language.label")}>
              {([
                ["en", "language.english"],
                ["ko", "language.korean"],
              ] as const).map(([value, labelKey]) => (
                <button
                  className={locale === value ? "is-active" : ""}
                  type="button"
                  aria-pressed={locale === value}
                  key={value}
                  lang={value}
                  onClick={() => onLocaleChange(value)}
                >
                  <span>{t(labelKey)}</span>
                  {locale === value ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
