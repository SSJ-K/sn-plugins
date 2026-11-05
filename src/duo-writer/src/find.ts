// Find in note: highlights every match of the current query and steps
// through them. Uses the search package's query and cursor only; no built-in panel.
import {StateField, StateEffect, EditorSelection, EditorState} from '@codemirror/state';
import {EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {SearchQuery} from '@codemirror/search';

export interface FindQuery {
  text: string;
  matchCase: boolean;   // off: capitals ignored (the default, as in Super)
  wholeWord: boolean;   // on: "cat" skips "category"
}

export const emptyFind: FindQuery = {text: '', matchCase: false, wholeWord: false};

export const setFindQuery = StateEffect.define<FindQuery>();

export const findQueryField = StateField.define<FindQuery>({
  create: () => emptyFind,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFindQuery)) value = e.value;
    return value;
  }
});

const matchMark = Decoration.mark({class: 'dw-match'});

// Matches of the current query between from and to, in order.
function* matches(state: EditorState, from = 0, to = state.doc.length) {
  const q = state.field(findQueryField);
  if (!q.text) return;
  const c = new SearchQuery({search: q.text, caseSensitive: q.matchCase, wholeWord: q.wholeWord, literal: true}).getCursor(state, from, to);
  for (let r = c.next(); !r.done; r = c.next()) yield {from: r.value.from, to: r.value.to};
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
    const ranges = [];
    for (const {from, to} of view.visibleRanges)
      for (const m of matches(view.state, from, to)) ranges.push(matchMark.range(m.from, m.to));
    return Decoration.set(ranges, true);
  }
}, {decorations: v => v.decorations});

export const findExtension = [findQueryField, highlighter];

/** Count of matches in the whole note. */
export function countMatches(state: EditorState): number {
  let n = 0;
  for (const _ of matches(state)) n++;
  return n;
}

/** Select the next match after the cursor, wrapping around the end. */
export function findNext(view: EditorView, backwards = false): boolean {
  const {state} = view;
  const sel = state.selection.main;
  let found: {from: number; to: number} | undefined;
  if (!backwards) {
    found = matches(state, sel.to).next().value || matches(state, 0, sel.to).next().value;
  } else {
    for (const m of matches(state, 0, sel.from)) found = m;
    if (!found) for (const m of matches(state, sel.from)) found = m;
  }
  if (!found) return false;
  view.dispatch({
    selection: EditorSelection.single(found.from, found.to),
    scrollIntoView: true,
    effects: EditorView.scrollIntoView(found.from, {y: 'center'})
  });
  return true;
}

/** Every match of the query in the whole note as one change list. */
export function replaceAllChanges(state: EditorState, text: string) {
  return [...matches(state)].map(m => ({...m, insert: text}));
}

/** Replace every match in one step, so one undo brings them all back. */
export function replaceAll(view: EditorView, text: string): boolean {
  const changes = replaceAllChanges(view.state, text);
  if (changes.length) view.dispatch({changes, userEvent: 'input.replace'});
  return changes.length > 0;
}

/** Replace the selected match, then move to the next; if no match is selected, select the next one first. */
export function replaceNext(view: EditorView, text: string): boolean {
  const {state} = view;
  const sel = state.selection.main;
  const m = sel.empty ? undefined : matches(state, sel.from, sel.to).next().value;
  if (m && m.from === sel.from && m.to === sel.to) {
    view.dispatch({
      changes: {from: sel.from, to: sel.to, insert: text},
      selection: EditorSelection.cursor(sel.from + text.length),
      userEvent: 'input.replace'
    });
  }
  return findNext(view);
}

// Self-check of replace all with each switch (runs once at load, console only).
if (typeof console !== 'undefined') {
  const doc = 'Cat cat CAT category dog';
  for (const [q, want] of [
    [{text: 'cat', matchCase: false, wholeWord: false}, 'x x x xegory dog'],
    [{text: 'cat', matchCase: true, wholeWord: false}, 'Cat x CAT xegory dog'],
    [{text: 'cat', matchCase: false, wholeWord: true}, 'x x x category dog'],
    [{text: 'cat', matchCase: true, wholeWord: true}, 'Cat x CAT category dog'],
  ] as [FindQuery, string][]) {
    const s = EditorState.create({doc, extensions: findQueryField}).update({effects: setFindQuery.of(q)}).state;
    const out = s.update({changes: replaceAllChanges(s, 'x')}).state.doc.toString();
    if (out !== want) console.error('replaceAll self-check failed', q, out);
  }
}
