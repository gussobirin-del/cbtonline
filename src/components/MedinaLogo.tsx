export function MedinaLogo({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20 2.5L35 8.5V19.5C35 28.4 28.6 35.6 20 38C11.4 35.6 5 28.4 5 19.5V8.5L20 2.5Z"
        fill="#0F2A52"
      />
      <path
        d="M20 5L32.5 10V19.4C32.5 26.8 27.2 32.8 20 35C12.8 32.8 7.5 26.8 7.5 19.4V10L20 5Z"
        stroke="#D9A338"
        strokeWidth="1.5"
      />
      <path
        d="M13.5 25V15L20 20.5L26.5 15V25"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="12" r="2" fill="#D9A338" />
    </svg>
  );
}
