// Editing commands behind the tools row and the keyboard shortcuts.
// Every command edits plain Markdown marks; nothing else is stored.
import {EditorView} from '@codemirror/view';
import {EditorState, EditorSelection, Text} from '@codemirror/state';

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

/** Length of the run of character c at the start (or the end) of s. */
function runOf(s: string, c: string, fromEnd: boolean): number {
  let n = 0;
  while (n < s.length && s[fromEnd ? s.length - 1 - n : n] === c) n++;
  return n;
}

// Does a run of mark characters carry this mark? ** is bold, not italic; *** is both.
const carries = (run: number, len: number) => len === 1 ? run % 2 === 1 : run >= len;

/** Wrap the selection in a mark (bold **, italic *); unwrap if already wrapped. */
export function toggleMark(mark: string) {
  return (view: EditorView) => {
    const {state} = view;
    const c = mark[0];
    const tr = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const len = mark.length;
      // Already wrapped inside the selection: **text**
      const inside = Math.min(runOf(text, c, false), runOf(text, c, true));
      if (inside * 2 < text.length && carries(inside, len)) {
        const inner = text.slice(len, text.length - len);
        return {
          changes: {from: range.from, to: range.to, insert: inner},
          range: EditorSelection.range(range.from, range.from + inner.length)
        };
      }
      // Already wrapped around the selection: **[text]**
      const before = state.sliceDoc(Math.max(0, range.from - 3), range.from);
      const after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + 3));
      if (carries(Math.min(runOf(before, c, true), runOf(after, c, false)), len)) {
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
// Matched pairs only, double marks first; underscores count only at word edges, so my_file_name stays.
const INLINE_PAIRS: [RegExp, string][] = [
  [/(\*\*|~~|==)(?=\S)(.*?\S)\1/g, '$2'],
  [/(^|\W)__(?=\S)(.*?\S)__(?!\w)/g, '$1$2'],
  [/\*(?=\S)(.*?\S)\*/g, '$1'],
  [/(^|\W)_(?=\S)(.*?\S)_(?!\w)/g, '$1$2'],
  [/`([^`\n]+)`/g, '$1']
];
const stripInline = (s: string) => INLINE_PAIRS.reduce((t, [re, to]) => t.replace(re, to), s);
const FENCE = /^\s{0,3}(```|~~~)/;

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

// A list line: indent, marker ("-", "*", "+", "1." or "1)"), the spaces after it. Checklists are "- " lines.
const LIST_ITEM = /^( *)([-*+]|\d+[.)])( +)/;

/**
 * Changes that move the given list lines one level right (Tab) or left (Shift+Tab), sub-items with them.
 * Right lines the item up under the text of the item above at its level (2 spaces under "- ", 3 under "1. "),
 * which is what Markdown needs to nest it; the first item of a list has nothing to go under and stays.
 * Left moves it to its parent's indent. A numbered item that becomes the first sub-item is renumbered to 1,
 * or preview would start the new list at its old number.
 */
export function listShiftChanges(doc: Text, lineNos: number[], right: boolean) {
  const changes: {from: number; to: number; insert: string}[] = [];
  const moved = new Map<number, number>(); // line number -> new indent
  for (const n of lineNos) {
    if (moved.has(n)) continue; // already moved as a sub-item of a line above
    const line = doc.line(n);
    const m = LIST_ITEM.exec(line.text);
    if (!m) continue;
    const indent = m[1].length;
    let target = -1, first = true;
    const deeper: number[] = [];
    for (let k = n - 1; k >= 1; k--) {
      const t = doc.line(k).text;
      if (!t.trim()) continue;
      const p = LIST_ITEM.exec(t);
      if (!p) { if (/^\S/.test(t)) break; continue; } // unindented text ends the list; item text lines are skipped
      const pi = p[1].length;
      if (right && pi > indent) { deeper.push(pi); continue; }
      if (right && pi === indent) {
        target = moved.get(k) ?? pi + p[2].length + p[3].length;
        first = !moved.has(k) && !deeper.includes(target);
      }
      if (!right && pi < indent) target = pi;
      if (pi <= indent) break;
    }
    if (!right && target < 0 && indent > 0) target = 0;
    if (target < 0 || target === indent) continue;
    const pad = ' '.repeat(target);
    if (right && first && /\d/.test(m[2])) changes.push({from: line.from, to: line.from + indent + m[2].length, insert: pad + '1' + m[2].slice(-1)});
    else changes.push({from: line.from, to: line.from + indent, insert: pad});
    moved.set(n, target);
    // Its sub-items and their text: the lines below indented deeper than it, until the list comes back to its level.
    for (let k = n + 1; k <= doc.lines; k++) {
      const t = doc.line(k).text;
      if (!t.trim()) continue;
      const ki = /^ */.exec(t)![0].length;
      if (ki <= indent) break;
      if (moved.has(k)) continue;
      const ni = Math.max(0, ki + target - indent);
      changes.push({from: doc.line(k).from, to: doc.line(k).from + ki, insert: ' '.repeat(ni)});
      moved.set(k, ni);
    }
  }
  return changes;
}

function shiftList(view: EditorView, right: boolean) {
  const {state} = view;
  const lineNos = new Set<number>();
  for (const r of state.selection.ranges)
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) lineNos.add(n);
  const nums = [...lineNos].sort((a, b) => a - b);
  // Not on a list line: leave Tab to the app, as before.
  if (!nums.some(n => LIST_ITEM.test(state.doc.line(n).text))) return false;
  const changes = listShiftChanges(state.doc, nums, right);
  if (changes.length) view.dispatch({changes, scrollIntoView: true});
  view.focus();
  return true;
}
export const indentList = (view: EditorView) => shiftList(view, true);
export const outdentList = (view: EditorView) => shiftList(view, false);

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
  const cleaned = stripInline(text
    .split('\n')
    .map(l => l.replace(HEADING, '').replace(CHECK, '$1').replace(BULLET, '$1').replace(NUMBER, '$1').replace(QUOTE, '$1'))
    .join('\n'));
  if (cleaned === text) return true;
  view.dispatch({changes: {from, to, insert: cleaned}, selection: EditorSelection.range(from, from + cleaned.length)});
  view.focus();
  return true;
}

/** Headings in the note, for the table of contents. */
export function headings(state: EditorState): {level: number; text: string; pos: number}[] {
  const out = [];
  // shortcut: any fence line opens or closes, so a ``` block closed by ~~~ miscounts; use the syntax tree if that bites.
  let fenced = false;
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (FENCE.test(line.text)) { fenced = !fenced; continue; }
    if (fenced) continue;
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
  // Whole calendar days, rounded: a daylight-saving day is 23 or 25 hours long.
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day.getTime() - sundayBefore.getTime()) / 86400000);
  return 'CW' + String(Math.floor(days / 7) + 1).padStart(2, '0');
}

/** Selected text to capitals (Cmd+Shift+U); Cmd+Z brings the original back. An empty selection is left alone. */
export function upperCase(view: EditorView) {
  const {state} = view;
  view.dispatch(state.changeByRange((r) => {
    if (r.empty) return {range: r};
    const up = state.sliceDoc(r.from, r.to).toUpperCase(); // may change length (ß becomes SS)
    return {changes: {from: r.from, to: r.to, insert: up}, range: EditorSelection.range(r.from, r.from + up.length)};
  }), {scrollIntoView: true});
  view.focus();
  return true;
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

// Self-check of the week rule and clear formatting against known cases (runs once at load, console only).
// Times are 00:30 on purpose: summer Sundays just after midnight once gave last week (2026-07-12 gave CW28).
if (typeof console !== 'undefined') {
  const cases: [number, number, number, string][] = [[2026, 0, 1, 'CW01'], [2026, 0, 3, 'CW01'], [2026, 0, 4, 'CW02'], [2026, 6, 12, 'CW29'], [2026, 10, 4, 'CW45'], [2025, 11, 31, 'CW53']];
  for (const [y, m, d, want] of cases) { const got = calendarWeek(new Date(y, m, d, 0, 30)); if (got !== want) console.error('calendarWeek self-check failed', y, m + 1, d, got, want); }
  const strips: [string, string][] = [['my_file_name 2*3', 'my_file_name 2*3'], ['**b** *i* _u_ ==h== `c` ~~s~~', 'b i u h c s'], ['***bi***', 'bi']];
  for (const [s, want] of strips) { const got = stripInline(s); if (got !== want) console.error('clearFormatting self-check failed', s, got, want); }
  const shifts: [string, number[], boolean, string][] = [
    ['- a\n- b', [2], true, '- a\n  - b'],
    ['- [ ] a\n- [ ] b', [2], true, '- [ ] a\n  - [ ] b'],
    ['1. a\n2. b\n3. c', [2], true, '1. a\n   1. b\n3. c'],
    ['1. a\n2. b\n3. c', [2, 3], true, '1. a\n   1. b\n   3. c'],
    ['- a\n  - x\n- b', [3], true, '- a\n  - x\n  - b'],
    ['- a', [1], true, '- a'],
    ['- a\n- b\n  - c', [2], true, '- a\n  - b\n    - c'],
    ['- a\n  - b\n    - c', [2], false, '- a\n- b\n  - c'],
    ['- a\n  - b', [1], false, '- a\n  - b'],
  ];
  for (const [src, lines, right, want] of shifts) {
    const doc = Text.of(src.split('\n'));
    const got = EditorState.create({doc}).update({changes: listShiftChanges(doc, lines, right)}).state.doc.toString();
    if (got !== want) console.error('list shift self-check failed', JSON.stringify(src), lines, right, JSON.stringify(got));
  }
}
