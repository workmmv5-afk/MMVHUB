import React, { useId } from 'react';

/** MMV-HUB mark: rounded "M" on a blue→violet tile with a gold key dot. */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className,
}) => {
  const gid = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id={gid}
          x1="0"
          y1="0"
          x2="512"
          y2="512"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1A73E8" />
          <stop offset="1" stopColor="#6750A4" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gid})`} />
      <path
        d="M140 356V172l116 112 116-112v184"
        stroke="#FFFFFF"
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="384" r="24" fill="#FBBC05" />
    </svg>
  );
};

export const LogoWordmark: React.FC<{ size?: number; className?: string }> = ({
  size = 28,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-2 select-none ${className}`}>
    <LogoMark size={size} />
    <span className="font-semibold tracking-tight whitespace-nowrap text-[#202124] dark:text-[#E8EAED]">
      MMV<span className="hub-text-accent">HUB</span>
    </span>
  </span>
);
