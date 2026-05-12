"use client";

const base = (size, className, rest) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className,
  "aria-hidden": "true",
  ...rest,
});

export function Mark({ size = 24, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <path d="M5 15 L12 4 L19 15 Z" />
      <circle cx="12" cy="11.4" r="1" fill="currentColor" stroke="none" />
      <path d="M3 19h18" />
    </svg>
  );
}

export function ArrowLeft({ size = 18, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <path d="M19.5 12H4.5" />
      <path d="M10.5 6 4.5 12l6 6" />
    </svg>
  );
}

export function ArrowRight({ size = 18, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <path d="M4.5 12h15" />
      <path d="M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function Chevron({ size = 16, className = "", open = false, ...rest }) {
  return (
    <svg
      {...base(size, className, rest)}
      style={{
        transition: "transform 200ms ease",
        transform: `rotate(${open ? 90 : 0}deg)`,
        ...rest.style,
      }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Calendar({ size = 18, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <circle cx="12" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Clock({ size = 18, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function Check({ size = 18, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.2l2.8 2.8L16 9.8" />
    </svg>
  );
}

export function Info({ size = 16, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.5V16.5" />
      <circle cx="12" cy="8.4" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Bell({ size = 16, className = "", ...rest }) {
  return (
    <svg {...base(size, className, rest)}>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5" />
      <path d="M4.5 16.5h15" />
      <path d="M10.2 19.5a2 2 0 0 0 3.6 0" />
      <path d="M12 4V2.5" />
    </svg>
  );
}
