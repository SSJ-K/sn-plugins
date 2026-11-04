// Editing commands behind the tools row and the keyboard shortcuts.
// Every command edits plain Markdown marks; nothing else is stored.
import {EditorView} from '@codemirror/view';
import {EditorState, EditorSelection} from '@codemirror/state';

const HEADING = /^(#{1,6})\s+/;
const CHECK = /^(\s*)- \[( |x|X)\] /;
const BULLET = /^(\s*)- /;

/** Heading level (1-6) of the line at the main cursor, 0 for body text. */
export function headingLevelAtCursor(state: EditorState): number {
  const line = state.doc.lineAt(state.selection.main.head);
  const m = HEADING.exec(line.text);
  return m ? m[1].length : 0;
}

/** Set every selected line to the given heading level (0 = body). */
export function setHeading(level: number) {
  return (view: EditorView) => {
    const {state} = view;
    const changes = [];
    const seen = new Set<number>();
    for (const range of state.selection.ranges) {
      const from = state.doc.lineAt(range.from).number;
      const to = state.doc.lineAt(range.to).number;
      for (let n = from; n <= to; n++) {
        if (seen.has(n)) continue;
        seen.add(n);
        const line = state.doc.line(n);
        const m = HEADING.exec(line.text);
        const prefix = level > 0 ? '#'.repeat(level) + ' ' : '';
        changes.push({from: line.from, to: line.from + (m ? m[0].length : 0), insert: prefix});
      }
    }
    view.dispatch({changes, scrollIntoView: true});
    view.focus();
    return true;
  };
}

/** Wrap the selection in a mark (bold **, italic *); unwrap if already wrapped. */
export function toggleMark(mark: string) {
  return (view: EditorView) => {
    const {state} = view;
    const tr = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const len = mark.length;
      // Already wrapped inside the selection: **text**
      if (text.length >= 2 * len && text.startsWith(mark) && text.endsWith(mark)) {
        const inner = text.slice(len, text.length - len);
        return {
          changes: {from: range.from, to: range.to, insert: inner},
          range: EditorSelection.range(range.from, range.from + inner.length)
        };
      }
      // Already wrapped around the selection: **[text]**
      const before = state.sliceDoc(Math.max(0, range.from - len), range.from);
      const after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + len));
      if (before === mark && after === mark) {
        return {
          changes: [
            {from: range.from - len, to: range.from, insert: ''},
            {from: range.to, to: range.to + len, insert: ''}
          ],
          range: EditorSelection.range(range.from - len, range.to - len)
        };
      }
      return {
        changes: [
          {from: range.from, insert: mark},
          {from: range.to, insert: mark}
        ],
        range: EditorSelection.range(range.from + len, range.to + len)
      };
    });
    view.dispatch(tr, {scrollIntoView: true});
    view.focus();
    return true;
  };
}

function forEachSelectedLine(view: EditorView, fn: (lineText: string, lineFrom: number) => {from: number; to: number; insert: string} | null) {
  const {state} = view;
  const changes = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    const from = state.doc.lineAt(range.from).number;
    const to = state.doc.lineAt(range.to).number;
    for (let n = from; n <= to; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      const c = fn(line.text, line.from);
      if (c) changes.push(c);
    }
  }
  view.dispatch({changes, scrollIntoView: true});
  view.focus();
  return true;
}

/** Bullet list on or off for every selected line. */
export function toggleBullet(view: EditorView) {
  return forEachSelectedLine(view, (text, from) => {
    const check = CHECK.exec(text);
    if (check) return {from: from + check[1].length, to: from + check[0].length, insert: ''};
    const bullet = BULLET.exec(text);
    if (bullet) return {from: from + bullet[1].length, to: from + bullet[0].length, insert: ''};
    const indent = /^\s*/.exec(text)[0].length;
    return {from: from + indent, to: from + indent, insert: '- '};
  });
}

/** Checklist on or off for every selected line; a bullet becomes a checkbox. */
export function toggleChecklist(view: EditorView) {
  return forEachSelectedLine(view, (text, from) => {
    const check = CHECK.exec(text);
    if (check) return {from: from + check[1].length, to: from + check[0].length, insert: ''};
    const bullet = BULLET.exec(text);
    if (bullet) return {from: from + bullet[1].length, to: from + bullet[0].length, insert: '- [ ] '};
    const indent = /^\s*/.exec(text)[0].length;
    return {from: from + indent, to: from + indent, insert: '- [ ] '};
  });
}

// ---- 0.3.0 additions -------------------------------------------------------

const QUOTE = /^(\s*)> ?/;
const NUMBER = /^(\s*)\d+\. /;
const INLINE_MARKS = /(\*\*|__|\*|_|~~|`)/g;

/** Quote on or off for every selected line. */
export function toggleQuote(view: EditorView) {
  return forEachSelectedLine(view, (text, from) => {
    const q = QUOTE.exec(text);
    if (q) return {from: from + q[1].length, to: from + q[0].length, insert: ''};
    const indent = /^\s*/.exec(text)[0].length;
    return {from: from + indent, to: from + indent, insert: '> '};
  });
}

/** Numbered list on or off for the selected lines, numbered 1., 2., 3. in order. */
export function toggleNumbered(view: EditorView) {
  let n = 0;
  return forEachSelectedLine(view, (text, from) => {
    const num = NUMBER.exec(text);
    if (num) return {from: from + num[1].length, to: from + num[0].length, insert: ''};
    const check = CHECK.exec(text) || BULLET.exec(text);
    n += 1;
    if (check) return {from: from + check[1].length, to: from + check[0].length, insert: `${n}. `};
    const indent = /^\s*/.exec(text)[0].length;
    return {from: from + indent, to: from + indent, insert: `${n}. `};
  });
}

/** Wrap the selection as a link: [text](url) with the cursor inside the parens. */
export function insertLink(view: EditorView) {
  const {state} = view;
  const r = state.selection.main;
  const text = state.sliceDoc(r.from, r.to);
  const insert = `[${text}]()`;
  view.dispatch({
    changes: {from: r.from, to: r.to, insert},
    selection: EditorSelection.cursor(r.from + insert.length - 1),
    scrollIntoView: true
  });
  view.focus();
  return true;
}

/** Fence the selected lines as a code block (or unfence if already fenced). */
export function toggleCodeBlock(view: EditorView) {
  const {state} = view;
  const r = state.selection.main;
  const first = state.doc.lineAt(r.from);
  const last = state.doc.lineAt(r.to);
  const prev = first.number > 1 ? state.doc.line(first.number - 1) : null;
  const next = last.number < state.doc.lines ? state.doc.line(last.number + 1) : null;
  if (prev && next && /^```/.test(prev.text) && /^```\s*$/.test(next.text)) {
    view.dispatch({changes: [
      {from: prev.from, to: first.from, insert: ''},
      {from: last.to, to: next.to, insert: ''}
    ]});
  } else {
    view.dispatch({
      changes: [
        {from: first.from, insert: '```\n'},
        {from: last.to, insert: '\n```'}
      ],
      selection: EditorSelection.cursor(first.from + 3)
    });
  }
  view.focus();
  return true;
}

/** Insert an empty table on its own lines after the current line. */
export function insertTable(view: EditorView) {
  const {state} = view;
  const line = state.doc.lineAt(state.selection.main.to);
  const table = '\n| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n';
  const prefix = line.text.length ? '\n' : '';
  const firstCell = table.indexOf('|  |') + 2; // cursor lands in the first empty cell
  view.dispatch({
    changes: {from: line.to, insert: prefix + table},
    selection: EditorSelection.cursor(line.to + prefix.length + firstCell),
    scrollIntoView: true
  });
  view.focus();
  return true;
}

/** Insert a divider line after the current line. */
export function insertDivider(view: EditorView) {
  const {state} = view;
  const line = state.doc.lineAt(state.selection.main.to);
  const prefix = line.text.length ? '\n' : '';
  const insert = prefix + '\n---\n';
  view.dispatch({
    changes: {from: line.to, insert},
    selection: EditorSelection.cursor(line.to + insert.length),
    scrollIntoView: true
  });
  view.focus();
  return true;
}

/** Strip inline marks from the selection and block prefixes from its lines. */
export function clearFormatting(view: EditorView) {
  const {state} = view;
  const r = state.selection.main;
  const first = state.doc.lineAt(r.from);
  const last = state.doc.lineAt(r.to);
  const from = r.empty ? first.from : r.from;
  const to = r.empty ? last.to : r.to;
  const text = state.sliceDoc(from, to);
  const cleaned = text
    .split('\n')
    .map(l => l.replace(HEADING, '').replace(CHECK, '$1').replace(BULLET, '$1').replace(NUMBER, '$1').replace(QUOTE, '$1'))
    .join('\n')
    .replace(INLINE_MARKS, '');
  if (cleaned === text) return true;
  view.dispatch({changes: {from, to, insert: cleaned}, selection: EditorSelection.range(from, from + cleaned.length)});
  view.focus();
  return true;
}

/** Headings in the note, for the table of contents. */
export function headings(state: EditorState): {level: number; text: string; pos: number}[] {
  const out = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    const m = HEADING.exec(line.text);
    if (m) out.push({level: m[1].length, text: line.text.slice(m[0].length).trim(), pos: line.from});
  }
  return out;
}

/** Jump to a position (used by the table of contents). */
export function jumpTo(view: EditorView, pos: number) {
  view.dispatch({selection: EditorSelection.cursor(pos), effects: EditorView.scrollIntoView(pos, {y: 'start', yMargin: 24})});
  view.focus();
}

/** Calendar week, Sunday start, week 1 holds January 1 (K's convention): "CW45". */
export function calendarWeek(d = new Date()): string {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const sundayBefore = new Date(jan1); sundayBefore.setDate(jan1.getDate() - jan1.getDay());
  const days = Math.floor((d.getTime() - sundayBefore.getTime()) / 86400000);
  return 'CW' + String(Math.floor(days / 7) + 1).padStart(2, '0');
}

/** Today as MM/DD/YYYY. */
export function todayMDY(d = new Date()): string {
  return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();
}

function insertAtCursor(view: EditorView, text: string) {
  const r = view.state.selection.main;
  view.dispatch({changes: {from: r.from, to: r.to, insert: text}, selection: EditorSelection.cursor(r.from + text.length), scrollIntoView: true});
  view.focus();
  return true;
}
export const insertCalendarWeek = (view: EditorView) => insertAtCursor(view, calendarWeek());
export const insertToday = (view: EditorView) => insertAtCursor(view, todayMDY());

// Self-check of the week rule against known dates (runs once at load, console only).
if (typeof console !== 'undefined') {
  const cases: [number, number, number, string][] = [[2026, 0, 1, 'CW01'], [2026, 0, 3, 'CW01'], [2026, 0, 4, 'CW02'], [2026, 10, 4, 'CW45'], [2025, 11, 31, 'CW53']];
  for (const [y, m, d, want] of cases) { const got = calendarWeek(new Date(y, m, d)); if (got !== want) console.error('calendarWeek self-check failed', y, m + 1, d, got, want); }
}
