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
    const icon = document.querySelector('[data-theme-value="' + selected + '"] svg');
    if (icon) document.querySelector("[data-theme-icon]")?.replaceChildren(icon.cloneNode(true));
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
    document.querySelector("[data-theme-icon]")?.replaceChildren(button.querySelector("svg").cloneNode(true));
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
  contents.open = !compact.matches;
  compact.addEventListener("change", (event) => { contents.open = !event.matches; });
}
