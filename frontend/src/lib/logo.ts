/** Simplified AWS wordmark as a data URI (used in the top bar and login page). */
const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="36" viewBox="0 0 60 36">
<text x="4" y="22" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="24" fill="${fill}">aws</text>
<path d="M6 29 Q 24 38 44 28" stroke="#ff9900" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M41 25.5 L46 27.8 L42.5 32" stroke="#ff9900" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
export const AWS_LOGO_LIGHT = `data:image/svg+xml;utf8,${encodeURIComponent(svg("#ffffff"))}`;
export const AWS_LOGO_DARK = `data:image/svg+xml;utf8,${encodeURIComponent(svg("#232f3e"))}`;
