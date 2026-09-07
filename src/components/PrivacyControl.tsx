import { useEffect, useState } from "react";
import { useLocalization } from "../i18n/useLocalization";
import { TouchSelectionDialog } from "./TouchSelectionDialog";

function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { locale, t } = useLocalization();
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadNotice() {
      try {
        const response = await fetch("/privacy.html", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Privacy notice unavailable");
        const document = new DOMParser().parseFromString(
          await response.text(),
          "text/html",
        );
        const article = document.querySelector(`article[lang="${locale}"]`);
        if (!article) throw new Error("Privacy translation unavailable");
        article.querySelector("h1")?.remove();
        article.querySelectorAll("a").forEach((link) => {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        });
        if (!controller.signal.aborted) setContent(article.innerHTML);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void loadNotice();
    return () => controller.abort();
  }, [locale]);

  return (
    <TouchSelectionDialog
      kind="privacy"
      title={t("footer.privacy")}
      showActions={false}
      onClose={onClose}
    >
      {content ? (
        // The HTML is the app's own static notice, never user or AI content.
        <article
          className="privacy-notice"
          lang={locale}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div className="privacy-notice" role="status">
          <p>{t(failed ? "privacy.loadFailed" : "common.loading")}</p>
          {failed ? (
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
              {t("privacy.openPage")}
            </a>
          ) : null}
        </div>
      )}
    </TouchSelectionDialog>
  );
}

export function PrivacyControl() {
  const { locale, t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="footer-privacy-button"
        type="button"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        {t("footer.privacy")}
      </button>
      {isOpen ? (
        <PrivacyDialog key={locale} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
