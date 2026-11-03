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
