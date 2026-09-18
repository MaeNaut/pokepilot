import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";
import "./workspaceTutorial.css";

const storageKey = "pokepilot.tutorial.introduction.v2";
const steps = [
  {
    image: "builder",
    ko: ["나만의 팀을 만들어보세요", "포켓몬을 고르면 사용률 데이터가 있는 경우 샘플이 자동으로 채워집니다. 기술과 노력치를 바꾸며 팀을 완성해보세요.", "팀 빌더의 샘플 편집 화면"],
    en: ["Build your team", "Choose a Pokemon to load a sample when usage data is available. Adjust its moves and effort values to make the team your own.", "Team builder showing sample editing"],
  },
  {
    image: "calculator",
    ko: ["대미지를 비교해보세요", "상대 포켓몬을 선택하고, 내 공격과 상대 공격의 피해량을 확인해보세요.", "계산기의 기술별 대미지와 타수 결과"],
    en: ["Compare damage", "Choose an opponent and compare the damage your Pokemon deals and receives.", "Calculator showing damage ranges and hits to KO"],
  },
  {
    image: "copilot",
    ko: ["PokePilot과 함께 다듬어보세요", "팀과 포켓몬을 분석하고, 어울리는 포켓몬과 샘플을 추천받아보세요.", "PokePilot의 팀 분석 예시"],
    en: ["Refine your team with PokePilot", "Analyze your team and Pokemon, or get recommendations for Pokemon and builds that fit.", "Example team analysis in PokePilot"],
  },
  {
    image: "help",
    ko: ["궁금할 때는 도움말을 확인하세요", "화면 아래 도움말에서 기능별 사용법과 계산 결과의 의미를 확인할 수 있습니다. 목차로 원하는 내용을 바로 찾아보세요.", "도움말의 목차와 시작하기 설명"],
    en: ["Find answers in Help", "Open Help at the bottom of the app for feature instructions and advice on reading calculations. Use the contents to jump to a topic.", "Help contents and getting started instructions"],
  },
];

function hasFinished() {
  try { return localStorage.getItem(storageKey) === "done"; }
  catch { return false; }
}

export function WorkspaceTutorial() {
  const { locale } = useLocalization();
  const ko = locale === "ko";
  const [open, setOpen] = useState(() => !hasFinished());
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, description, alt] = ko ? steps[index].ko : steps[index].en;

  function finish() {
    try { localStorage.setItem(storageKey, "done"); } catch { /* Storage is optional. */ }
    setOpen(false);
  }

  useEffect(() => {
    function restart() { setIndex(0); setOpen(true); }
    window.addEventListener("pokepilot:tutorial", restart);
    return () => window.removeEventListener("pokepilot:tutorial", restart);
  }, []);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Native modal behavior keeps keyboard focus and pointer interaction inside the tutorial.
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <dialog ref={dialog} className="tutorial-card" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" onCancel={(event) => { event.preventDefault(); finish(); }}>
      <div className="tutorial-top">
        <span>{index + 1} / {steps.length}</span>
        <button type="button" onClick={finish} aria-label={ko ? "튜토리얼 닫기" : "Close tutorial"} title={ko ? "닫기" : "Close"}><FontAwesomeIcon icon={faXmark} /></button>
      </div>
      <div className="tutorial-image">
        <a href={`/tutorial/${steps[index].image}.jpg`} target="_blank" rel="noopener noreferrer" aria-label={ko ? "이미지 원본 보기" : "View full-size image"} title={ko ? "이미지 원본 보기" : "View full-size image"}>
          <img src={`/tutorial/${steps[index].image}.jpg`} alt={alt} />
        </a>
      </div>
      <div className="tutorial-copy" aria-live="polite">
        <h2 id="tutorial-title">{title}</h2>
        <p id="tutorial-description">{description}</p>
        {steps[index].image === "help" && <a className="tutorial-help-link" href={ko ? "/help/ko.html" : "/help/en.html"} target="_blank" rel="noopener noreferrer">{ko ? "도움말 열기" : "Open Help"}</a>}
      </div>
      <div className="tutorial-actions">
        <button type="button" onClick={finish}>{ko ? "건너뛰기" : "Skip"}</button>
        <div>
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label={ko ? "이전 단계" : "Previous step"} title={ko ? "이전" : "Previous"}><FontAwesomeIcon icon={faArrowLeft} /></button>
          <button type="button" className="tutorial-next" onClick={() => index === steps.length - 1 ? finish() : setIndex(index + 1)}>
            {index === steps.length - 1 ? (ko ? "시작하기" : "Get started") : (ko ? "다음" : "Next")}<FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>
    </dialog>, document.body,
  );
}
