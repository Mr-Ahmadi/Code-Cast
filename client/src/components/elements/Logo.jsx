import PropTypes from 'prop-types';

/**
 * The Code Cast mark: a code chevron broadcasting from a record dot.
 *
 * Inlined rather than loaded as an <img> so it stays crisp at any size and
 * inherits no network cost. Gradient ids are suffixed per instance so several
 * logos can coexist on one page without clashing.
 */
export default function Logo({ size = 32, className = '', title = 'Code Cast' }) {
  const uid = `cc-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#C8615E" />
          <stop offset="48%" stopColor="#A84341" />
          <stop offset="100%" stopColor="#7E2B29" />
        </linearGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0.3" y2="0.9">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.20" />
        </linearGradient>
      </defs>

      <rect x="48" y="48" width="416" height="416" rx="104" fill={`url(#${uid}-bg)`} />
      <rect x="48" y="48" width="416" height="416" rx="104" fill={`url(#${uid}-sheen)`} />
      <rect
        x="49.25" y="49.25" width="413.5" height="413.5" rx="102.75"
        fill="none" stroke={`url(#${uid}-edge)`} strokeWidth="2.5"
      />

      <path
        d="M 154 178 L 218 256 L 154 334"
        fill="none" stroke="#ffffff" strokeWidth="34"
        strokeLinecap="round" strokeLinejoin="round"
      />

      <circle cx="274" cy="256" r="22" fill="#ffffff" />
      <path
        d="M 305.8 205.1 A 60 60 0 0 1 305.8 306.9"
        fill="none" stroke="#ffffff" strokeWidth="18"
        strokeLinecap="round" opacity="0.78"
      />
      <path
        d="M 327 171.2 A 100 100 0 0 1 327 340.8"
        fill="none" stroke="#ffffff" strokeWidth="16"
        strokeLinecap="round" opacity="0.42"
      />
    </svg>
  );
}

Logo.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
  title: PropTypes.string,
};
