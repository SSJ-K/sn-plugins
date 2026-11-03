// Markdown marks: drawn in light grey (iA style), or hidden on every line
// except the one being edited (Bear style) when "hide marks" is on.
import {StateField, StateEffect, EditorState, RangeSetBuilder} from '@codemirror/state';
import {EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {syntaxTree} from '@codemirror/language';

export const setHideMarks = StateEffect.define<boolean>();

export const hideMarksField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setHideMarks)) value = e.value;
    return value;
  }
});

// Nodes that are pure syntax. HeaderMark also swallows the space after it.
const MARK_NODES = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark', 'CodeMark', 'LinkMark', 'QuoteMark']);

const hidden = Decoration.replace({});

function linesWithCursor(state: EditorState): Set<number> {
  const s = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) s.add(n);
  }
  return s;
}

function build(view: EditorView): DecorationSet {
  if (!view.state.field(hideMarksField)) return Decoration.none;
  const {state} = view;
  const active = linesWithCursor(state);
  const ranges: {from: number; to: number}[] = [];
  for (const {from, to} of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter(node) {
        const name = node.name;
        if (name === 'URL') {
          // In a [text](url) link hide the url; the surrounding LinkMarks go too.
          if (!active.has(state.doc.lineAt(node.from).number)) ranges.push({from: node.from, to: node.to});
          return;
        }
        if (!MARK_NODES.has(name)) return;
        const line = state.doc.lineAt(node.from);
        if (active.has(line.number)) return;
        let end = node.to;
        if (name === 'HeaderMark' || name === 'QuoteMark') {
          // Hide the following space as well so the text sits flush left.
          if (end < line.to && state.doc.sliceString(end, end + 1) === ' ') end += 1;
          // Trailing "#" marks of a closed heading: leave them, rare.
        }
        if (name === 'LinkMark') {
          // Keep an unobtrusive hint that this is a link: hide only the brackets and parens.
        }
        ranges.push({from: node.from, to: end});
      }
    });
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const b = new RangeSetBuilder<Decoration>();
  let last = -1;
  for (const r of ranges) {
    if (r.from < last) continue; // skip overlaps (e.g. LinkMark inside a hidden URL)
    if (r.to > r.from) b.add(r.from, r.to, hidden);
    last = r.to;
  }
  return b.finish();
}

const hider = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = build(view); }
  update(u: ViewUpdate) {
    const toggled = u.transactions.some(tr => tr.effects.some(e => e.is(setHideMarks)));
    // The parser works in the background and finishes after the first paint;
    // a new tree must rebuild the decorations too, or inline marks stay visible.
    const reparsed = syntaxTree(u.state) !== syntaxTree(u.startState);
    if (u.docChanged || u.viewportChanged || u.selectionSet || toggled || reparsed) this.decorations = build(u.view);
  }
}, {decorations: v => v.decorations});

export const marksExtension = [hideMarksField, hider];
