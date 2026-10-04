(() => {
  const ko = document.documentElement.lang === "ko";
  document.querySelectorAll(".analysis-figure").forEach((figure, index) => {
    const link = figure.querySelector("a[data-analysis-image]");
    if (!link) return;
    link.id = `analysis-preview-${index}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "analysis-expand";
    button.setAttribute("aria-controls", link.id);
    button.setAttribute("aria-expanded", "false");
    const expandLabel = ko ? "분석 결과 전체 펼치기" : "Show full analysis";
    const collapseLabel = ko ? "분석 결과 접기" : "Show less";
    button.textContent = expandLabel;
    figure.classList.add("is-collapsible");
    link.after(button);
    const preview = link.querySelector("img");
    if (preview && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        const limit = parseFloat(getComputedStyle(figure).getPropertyValue("--analysis-preview-height"));
        button.hidden = preview.clientHeight <= limit;
        figure.classList.toggle("has-overflow", !button.hidden);
      }).observe(preview);
    }
    button.addEventListener("click", () => {
      const expanded = figure.classList.toggle("is-expanded");
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded ? collapseLabel : expandLabel;
      // Keep the preview in view when collapsing a result from its bottom edge.
      if (!expanded && figure.getBoundingClientRect().top < 0) {
        figure.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
  });
  if (typeof HTMLDialogElement === "undefined") return;
  const copy = ko
    ? { title: "PokePilot 분석 화면", zoom: "원본 크기로 확대", fit: "화면에 맞추기", close: "닫기" }
    : { title: "PokePilot analysis screen", zoom: "Zoom to original size", fit: "Fit to screen", close: "Close" };
  const dialog = document.createElement("dialog");
  dialog.className = "image-viewer";
  dialog.setAttribute("aria-labelledby", "image-viewer-title");
  dialog.innerHTML = `<div class="image-viewer-toolbar"><strong id="image-viewer-title"></strong><button type="button" class="image-viewer-zoom" aria-pressed="false">+</button><button type="button" class="image-viewer-close" autofocus>×</button></div><div class="image-viewer-stage" tabindex="0"><img alt="" /></div>`;
  dialog.querySelector("strong").textContent = copy.title;
  const stage = dialog.querySelector(".image-viewer-stage");
  stage.setAttribute("aria-label", copy.title);
  const image = stage.querySelector("img");
  const zoom = dialog.querySelector(".image-viewer-zoom");
  const close = dialog.querySelector(".image-viewer-close");
  close.title = copy.close;
  close.setAttribute("aria-label", copy.close);
  document.body.append(dialog);
  let opener = null;
  let previousOverflow = "";
  function setZoom(enabled) {
    stage.classList.toggle("is-zoomed", enabled);
    zoom.textContent = enabled ? "−" : "+";
    zoom.title = enabled ? copy.fit : copy.zoom;
    zoom.setAttribute("aria-label", zoom.title);
    zoom.setAttribute("aria-pressed", String(enabled));
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }
  zoom.addEventListener("click", () => setZoom(!stage.classList.contains("is-zoomed")));
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    opener?.focus({ preventScroll: true });
  });
  document.querySelectorAll("a[data-analysis-image]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      image.src = link.href;
      image.alt = link.querySelector("img")?.alt ?? copy.title;
      setZoom(false);
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
    });
  });
})();
