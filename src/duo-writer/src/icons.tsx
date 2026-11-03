// Thin line icons, 20 x 20, stroke 1.6, drawn here so nothing external loads.
import React from 'react';

const base = {width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true};

export const I = {
  undo: () => <svg {...base}><path d="M7 5 3.5 8.5 7 12"/><path d="M4 8.5h8a4 4 0 0 1 0 8H9"/></svg>,
  redo: () => <svg {...base}><path d="m13 5 3.5 3.5L13 12"/><path d="M16 8.5H8a4 4 0 0 0 0 8h3"/></svg>,
  bold: () => <svg {...base}><path d="M6 4h5.5a3 3 0 0 1 0 6H6zM6 10h6.5a3 3 0 0 1 0 6H6z"/></svg>,
  italic: () => <svg {...base}><path d="M11 4h5M4 16h5M12.5 4l-5 12"/></svg>,
  strike: () => <svg {...base}><path d="M4 10h12"/><path d="M14 6.5c-.5-1.5-2-2.5-4-2.5-2.5 0-4 1.3-4 3 0 1 .5 1.7 1.5 2.2M6 13.5c.5 1.5 2 2.5 4 2.5 2.5 0 4-1.3 4-3 0-.6-.2-1.1-.5-1.5"/></svg>,
  link: () => <svg {...base}><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"/></svg>,
  code: () => <svg {...base}><path d="m7 6-4 4 4 4M13 6l4 4-4 4"/></svg>,
  codeBlock: () => <svg {...base}><rect x="3" y="4" width="14" height="12" rx="2"/><path d="m8 8-2 2 2 2M12 8l2 2-2 2"/></svg>,
  quote: () => <svg {...base}><path d="M5 5v10"/><path d="M9 7h7M9 10h7M9 13h5"/></svg>,
  bullets: () => <svg {...base}><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="10" r="1" fill="currentColor"/><circle cx="5" cy="14" r="1" fill="currentColor"/><path d="M9 6h8M9 10h8M9 14h8"/></svg>,
  numbers: () => <svg {...base}><path d="M4 5h1.5v3M4 8h3M4 12h3l-3 3h3" /><path d="M9.5 6h7.5M9.5 10h7.5M9.5 14h7.5"/></svg>,
  checks: () => <svg {...base}><rect x="3" y="4" width="5" height="5" rx="1"/><path d="m4.3 6.6 1.2 1.2 2.2-2.4"/><rect x="3" y="11" width="5" height="5" rx="1"/><path d="M11 6.5h6M11 13.5h6"/></svg>,
  table: () => <svg {...base}><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8.5h14M3 12.5h14M9 4v12"/></svg>,
  divider: () => <svg {...base}><path d="M3 10h14"/><path d="M6 5h8M6 15h8" opacity=".45"/></svg>,
  toc: () => <svg {...base}><path d="M4 5h12M4 9h8M4 13h10M4 17h6"/></svg>,
  clear: () => <svg {...base}><path d="m5 13 5-8h4l-5 8z"/><path d="M4 16h12"/><path d="M9 13H5"/></svg>,
  search: () => <svg {...base}><circle cx="9" cy="9" r="5"/><path d="m13 13 4 4"/></svg>,
  eye: () => <svg {...base}><path d="M2.5 10s3-5 7.5-5 7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/></svg>,
  eyeOff: () => <svg {...base}><path d="M2.5 10s3-5 7.5-5c1.3 0 2.5.4 3.5 1M17.5 10s-3 5-7.5 5c-1.3 0-2.5-.4-3.5-1"/><path d="m4 16 12-12"/></svg>,
  chevron: () => <svg {...base} width={14} height={14}><path d="m6 8 4 4 4-4"/></svg>,
  close: () => <svg {...base}><path d="m6 6 8 8M14 6l-8 8"/></svg>,
  prev: () => <svg {...base}><path d="m12 5-5 5 5 5"/></svg>,
  next: () => <svg {...base}><path d="m8 5 5 5-5 5"/></svg>,
  tools: () => <svg {...base}><path d="M4 6h12M4 10h12M4 14h12"/></svg>
};
