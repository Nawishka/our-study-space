import { useId } from "react";
import { NAMES, type Student } from "./domain";

/** Original vector companions. Instance-specific gradients also work in rewards. */
export default function Character({ student }: { student: Student }) {
  const id = useId().replaceAll(":", "");
  const girl = student === "shashi";
  return (
    <svg
      className="study-companion"
      viewBox="0 0 120 160"
      role="img"
      aria-label={NAMES[student] + " study companion"}
    >
      <defs>
        <radialGradient id={`${id}-skin`} cx=".35" cy=".25" r=".85">
          <stop stopColor="#ffdfbc" />
          <stop offset=".7" stopColor="#edbc99" />
          <stop offset="1" stopColor="#d9997c" />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x2=".8" y2="1">
          <stop stopColor="#5e4139" />
          <stop offset="1" stopColor="#2d2428" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={girl ? "#e0d1f4" : "#c3e1cf"} />
          <stop offset=".5" stopColor={girl ? "#bca4db" : "#93bda7"} />
          <stop offset="1" stopColor={girl ? "#8b6fae" : "#628c79"} />
        </linearGradient>
        <linearGradient id={`${id}-book`} x2="1" y2="1">
          <stop stopColor="#fff8e7" />
          <stop offset="1" stopColor="#d9c9a8" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="76" r="49" fill="var(--companion-halo)" />
      <ellipse cx="60" cy="152" rx="32" ry="5" fill="var(--companion-shadow)" />
      {girl && (
        <path
          d="M27 45Q17 8 60 9Q101 7 94 53L101 104Q86 118 74 104H42Q23 115 18 102Z"
          fill={`url(#${id}-hair)`}
        />
      )}
      <path
        d="M44 121l-2 22m34-22 2 22"
        stroke={girl ? "#685c7b" : "#455d58"}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M42 144H31m47 0h12"
        stroke="#f2e9d8"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M27 149h20m26 0h22"
        stroke="#c4b5a1"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M35 84Q60 73 85 84Q96 97 86 128Q60 135 34 128Q25 100 35 84Z"
        fill={`url(#${id}-top)`}
      />
      <path
        d="M47 82q13 19 27 0"
        fill="none"
        stroke={girl ? "#ede3f9" : "#e0f0e6"}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect x="52" y="70" width="16" height="16" rx="7" fill="#e6ad8b" />
      <circle cx="29" cy="50" r="7" fill="#edbb98" />
      <circle cx="91" cy="50" r="7" fill="#edbb98" />
      <ellipse cx="60" cy="47" rx="32" ry="33" fill={`url(#${id}-skin)`} />
      {girl ? (
        <>
          <path
            d="M27 44Q18 10 57 11Q98 8 94 46Q73 40 60 23Q45 42 27 44Z"
            fill={`url(#${id}-hair)`}
          />
          <path
            d="M34 27q10-13 23-12"
            fill="none"
            stroke="#856154"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M85 27q-13-13-13 0q0 10 13 3q11 11 13-1q0-11-13-2Z"
            fill="#ccb4e8"
            stroke="#a98acb"
          />
          <circle cx="85" cy="28" r="3" fill="#f3e8ff" />
        </>
      ) : (
        <>
          <path
            d="M27 45Q17 25 31 17Q38 5 58 10Q73 3 83 15Q100 21 94 47L84 34Q67 36 54 26Q41 39 31 34Z"
            fill={`url(#${id}-hair)`}
          />
          <path
            d="M33 24q10-10 23-9m7 1q9-4 17 5"
            fill="none"
            stroke="#896553"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      <path
        d="M40 45q5-3 9-1m22 0q5-2 9 1"
        fill="none"
        stroke="#60463c"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="45" cy="52" rx="3.3" ry="4.3" fill="#302a30" />
      <ellipse cx="76" cy="52" rx="3.3" ry="4.3" fill="#302a30" />
      <circle cx="46" cy="50.5" r="1.1" fill="#fff9ed" />
      <circle cx="77" cy="50.5" r="1.1" fill="#fff9ed" />
      {girl && (
        <path
          d="M41 50l-3-2m41 2 3-2"
          stroke="#302a30"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      <ellipse cx="37" cy="61" rx="7" ry="4" fill="#da8d83" opacity=".46" />
      <ellipse cx="84" cy="61" rx="7" ry="4" fill="#da8d83" opacity=".46" />
      <path
        d="M58 57q3 3 5 0"
        fill="none"
        stroke="#c58d72"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M53 65q8 9 16-1"
        fill="#9b5a53"
        stroke="#9b5a53"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M56 65q5 2 10 0"
        fill="none"
        stroke="#fff0dd"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 92q-8 15 4 23m52-23q8 16-4 23"
        fill="none"
        stroke={`url(#${id}-top)`}
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M38 101q11-3 22 4q12-8 24-4v27q-13-3-24 4q-12-6-22-3Z"
        fill={girl ? "#77618d" : "#487364"}
      />
      <path
        d="M39 98q11-2 21 5q12-8 23-5v26q-13-2-23 5q-11-6-21-3Z"
        fill={`url(#${id}-book)`}
      />
      <path
        d="M60 104v24m-16-22 10 3m-10 3 10 3m12-8 10-3m-10 9 10-3"
        fill="none"
        stroke="#b7a98d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M74 100v12l3-3 3 1v-12" fill={girl ? "#b098d0" : "#7ba994"} />
      <ellipse
        cx="36"
        cy="114"
        rx="5"
        ry="7"
        transform="rotate(-18 36 114)"
        fill={`url(#${id}-skin)`}
      />
      <ellipse
        cx="86"
        cy="114"
        rx="5"
        ry="7"
        transform="rotate(18 86 114)"
        fill={`url(#${id}-skin)`}
      />
      <path
        d="M20 79l-6 11 8 4 6-11Z"
        fill={girl ? "#cab4e1" : "#a9cbb7"}
        opacity=".85"
      />
      <path
        d="M100 72v8m-4-4h8"
        stroke={girl ? "#ba9cd6" : "#96bda6"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
