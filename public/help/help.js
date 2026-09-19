const helpLocale = document.documentElement.lang === "ko" ? "ko" : "en";

const helpCopy = helpLocale === "ko"
  ? {
      settings: "설정",
      theme: "테마",
      system: "시스템",
      light: "라이트",
      dark: "다크",
      language: "언어",
      korean: "한국어",
      returnToApp: "앱으로 돌아가기",
    }
  : {
      settings: "Settings",
      theme: "Theme",
      system: "System",
      light: "Light",
      dark: "Dark",
      language: "Language",
      korean: "한국어",
      returnToApp: "Return to app",
    };

const accountIcon = `<svg aria-hidden="true" viewBox="0 0 448 512" fill="currentColor"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3 0 498.7 13.3 512 29.7 512h388.6c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304h-91.4z"></path></svg>`;
const contentsIcon = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>`;

function renderHeader() {
  const header = document.querySelector("body > header");
  if (!header) return;

  const isKorean = helpLocale === "ko";
  header.className = "help-header";
  header.innerHTML = `
    <a class="help-wordmark" href="/" aria-label="PokePilot">
      <img src="/favicon.svg" width="22" height="22" alt="" />
      <span>PokePilot</span>
    </a>
    <a class="help-compact-home" href="/" aria-label="${helpCopy.returnToApp}" title="${helpCopy.returnToApp}">
      <img src="/favicon.svg" width="22" height="22" alt="" />
    </a>
    <details class="preference-control help-account-menu">
      <summary class="help-account-trigger" aria-label="${helpCopy.settings}" title="${helpCopy.settings}">
        <span class="help-account-avatar">${accountIcon}</span>
      </summary>
      <div class="preference-menu help-account-popover" aria-label="${helpCopy.settings}">
        <section class="help-account-section" aria-label="${helpCopy.theme}">
          <strong>${helpCopy.theme}</strong>
          <div class="help-account-choice-group" role="group" aria-label="${helpCopy.theme}">
            <button type="button" data-theme-value="system" aria-label="${helpCopy.system}" aria-pressed="false"><span>${helpCopy.system}</span></button>
            <button type="button" data-theme-value="light" aria-label="${helpCopy.light}" aria-pressed="false"><span>${helpCopy.light}</span></button>
            <button type="button" data-theme-value="dark" aria-label="${helpCopy.dark}" aria-pressed="false"><span>${helpCopy.dark}</span></button>
          </div>
        </section>
        <section class="help-account-section" aria-label="${helpCopy.language}">
          <strong>${helpCopy.language}</strong>
          <div class="help-account-choice-group" role="group" aria-label="${helpCopy.language}">
            <a href="/help/ko.html" lang="ko" data-locale="ko"${isKorean ? " aria-current=\"page\"" : ""}><span>${helpCopy.korean}</span></a>
            <a href="/help/en.html" lang="en" data-locale="en"${isKorean ? "" : " aria-current=\"page\""}><span>English</span></a>
          </div>
        </section>
      </div>
    </details>`;
}

renderHeader();

function syncTheme() {
  try {
    const theme = localStorage.getItem("pokepilot:theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    const selected = theme === "light" || theme === "dark" ? theme : "system";
    document.querySelectorAll("[data-theme-value]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeValue === selected));
    });
  } catch { /* Help remains readable when storage is unavailable. */ }
}
syncTheme();
window.addEventListener("storage", (event) => {
  if (event.key === "pokepilot:theme" || event.key === null) syncTheme();
});

document.querySelectorAll("[data-theme-value]").forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.themeValue;
    try { localStorage.setItem("pokepilot:theme", value); } catch { /* Storage is optional. */ }
    syncTheme();
    // Apply the choice even when storage is disabled.
    if (value === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    document.querySelectorAll("[data-theme-value]").forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
    const details = button.closest("details");
    details.open = false;
    details.querySelector("summary").focus();
  });
});
document.querySelectorAll("[data-locale]").forEach((link) => {
  link.addEventListener("click", () => {
    try { localStorage.setItem("pokepilot:locale", link.dataset.locale); } catch { /* Navigation still works. */ }
  });
});
const preferences = [...document.querySelectorAll(".preference-control")];
preferences.forEach((details) => {
  details.addEventListener("toggle", () => {
    if (details.open) preferences.forEach((other) => { if (other !== details) other.open = false; });
  });
});
document.addEventListener("click", (event) => {
  preferences.forEach((details) => { if (!details.contains(event.target)) details.open = false; });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") preferences.forEach((details) => {
    if (details.open) { details.open = false; details.querySelector("summary").focus(); }
  });
});

const contents = document.querySelector("aside details");
const compact = matchMedia("(max-width: 760px)");
if (contents) {
  const summary = contents.querySelector("summary");
  const contentsLabel = summary?.textContent.trim() || "Contents";
  let summaryLabel = null;
  if (summary) {
    summary.setAttribute("aria-label", contentsLabel);
    summary.innerHTML = `${contentsIcon}<span>${contentsLabel}</span>`;
    summaryLabel = summary.querySelector("span");
  }

  contents.open = !compact.matches;
  const topics = [...contents.querySelectorAll("a[href^='#']")].map((link, index) => ({
    link,
    label: `${index + 1}. ${link.textContent.trim()}`,
    target: document.getElementById(link.getAttribute("href").slice(1)),
  })).filter((topic) => topic.target);

  const syncCurrentTopic = () => {
    const current = topics.filter((topic) => topic.target.getBoundingClientRect().top <= 136).at(-1) || topics[0];
    if (!current) return;

    topics.forEach((topic) => {
      const isCurrent = topic === current;
      topic.link.classList.toggle("is-current", isCurrent);
      if (isCurrent) topic.link.setAttribute("aria-current", "location");
      else topic.link.removeAttribute("aria-current");
    });

    if (compact.matches && summaryLabel) {
      summaryLabel.textContent = current.label;
      summary.setAttribute("aria-label", `${contentsLabel}: ${current.label}`);
    } else if (summaryLabel) {
      summaryLabel.textContent = contentsLabel;
      summary.setAttribute("aria-label", contentsLabel);
    }
  };

  let scrollFrame = 0;
  const scheduleCurrentTopicSync = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      syncCurrentTopic();
    });
  };

  const contentsPanel = contents.querySelector("ol");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let contentsAnimation = null;
  let contentsClosing = false;
  const setContentsOpen = (open) => {
    contentsAnimation?.cancel();

    if (!compact.matches || !contentsPanel || reducedMotion.matches) {
      contents.open = open;
      contentsClosing = false;
      return;
    }

    if (open) {
      contentsClosing = false;
      contents.open = true;
      contentsAnimation = contentsPanel.animate([
        { opacity: 0, transform: "translateY(-6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      return;
    }

    contentsClosing = true;
    contentsAnimation = contentsPanel.animate([
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(-6px)" },
    ], { duration: 130, easing: "ease-in" });
    contentsAnimation.onfinish = () => {
      if (contentsClosing) contents.open = false;
      contentsClosing = false;
      contentsAnimation = null;
    };
    contentsAnimation.oncancel = () => { contentsAnimation = null; };
  };

  summary?.addEventListener("click", (event) => {
    if (!compact.matches) return;
    event.preventDefault();
    setContentsOpen(contentsClosing || !contents.open);
  });

  compact.addEventListener("change", (event) => {
    contentsAnimation?.cancel();
    contentsClosing = false;
    contents.open = !event.matches;
    scheduleCurrentTopicSync();
  });
  window.addEventListener("scroll", scheduleCurrentTopicSync, { passive: true });
  window.addEventListener("resize", scheduleCurrentTopicSync);
  syncCurrentTopic();

  contents.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
      if (compact.matches) setContentsOpen(false);
    });
  });
}
