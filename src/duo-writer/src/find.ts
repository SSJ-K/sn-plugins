// Find in note: highlights every match of the current query and steps
// through them. Uses the search package's cursor only; no built-in panel.
import {StateField, StateEffect, EditorSelection, EditorState} from '@codemirror/state';
import {EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {SearchCursor} from '@codemirror/search';

export const setFindQuery = StateEffect.define<string>();

export const findQueryField = StateField.define<string>({
  create: () => '',
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFindQuery)) value = e.value;
    return value;
  }
});

const matchMark = Decoration.mark({class: 'dw-match'});
const normalize = (s: string) => s.toLowerCase();

function cursorFor(state: EditorState, query: string, from = 0, to = state.doc.length) {
  return new SearchCursor(state.doc, query, from, to, normalize);
}

const highlighter = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = this.build(view);
  }
  update(u: ViewUpdate) {
    const queryChanged = u.transactions.some(tr => tr.effects.some(e => e.is(setFindQuery)));
    if (u.docChanged || u.viewportChanged || queryChanged) this.decorations = this.build(u.view);
  }
  build(view: EditorView): DecorationSet {
    const query = view.state.field(findQueryField);
    if (!query) return Decoration.none;
    const ranges = [];
    for (const {from, to} of view.visibleRanges) {
      const c = cursorFor(view.state, query, from, to);
      while (!c.next().done) ranges.push(matchMark.range(c.value.from, c.value.to));
    }
    return Decoration.set(ranges, true);
  }
}, {decorations: v => v.decorations});

export const findExtension = [findQueryField, highlighter];

/** Count of matches in the whole note. */
export function countMatches(state: EditorState): number {
  const query = state.field(findQueryField);
  if (!query) return 0;
  let n = 0;
  const c = cursorFor(state, query);
  while (!c.next().done) n++;
  return n;
}

/** Select the next match after the cursor, wrapping around the end. */
export function findNext(view: EditorView, backwards = false): boolean {
  const {state} = view;
  const query = state.field(findQueryField);
  if (!query) return false;
  const sel = state.selection.main;
  let found: {from: number; to: number} | null = null;
  if (!backwards) {
    let c = cursorFor(state, query, sel.to);
    if (!c.next().done) found = c.value;
    else {
      c = cursorFor(state, query, 0, sel.to);
      if (!c.next().done) found = c.value;
    }
  } else {
    let last: {from: number; to: number} | null = null;
    const c = cursorFor(state, query, 0, Math.max(0, sel.from));
    while (!c.next().done) last = {from: c.value.from, to: c.value.to};
    if (!last) {
      const c2 = cursorFor(state, query, sel.from);
      while (!c2.next().done) last = {from: c2.value.from, to: c2.value.to};
    }
    found = last;
  }
  if (!found) return false;
  view.dispatch({
    selection: EditorSelection.single(found.from, found.to),
    scrollIntoView: true,
    effects: EditorView.scrollIntoView(found.from, {y: 'center'})
  });
  return true;
}
