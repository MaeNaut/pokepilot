import type { SVGProps } from "react";

export function PokePilotMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M59 18C48 10 31 10 17 14C11 16 11 22 17 24C32 29 49 25 60 20Z"
        fill="currentColor"
      />
      <path
        d="M69 18C80 10 97 10 111 14C117 16 117 22 111 24C96 29 79 25 68 20Z"
        fill="currentColor"
      />
      <path
        d="M64 18V34"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle
        cx="64"
        cy="75"
        r="42"
        stroke="currentColor"
        strokeWidth="7"
      />
      <path
        d="M22 75H106"
        stroke="currentColor"
        strokeWidth="7"
      />
      <circle
        cx="46"
        cy="75"
        r="12"
        fill="var(--copilot-panel-background)"
        stroke="currentColor"
        strokeWidth="6"
      />
      <circle
        cx="82"
        cy="75"
        r="12"
        fill="var(--copilot-panel-background)"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path
        d="M58 75H70"
        stroke="currentColor"
        strokeWidth="6"
      />
    </svg>
  );
}
