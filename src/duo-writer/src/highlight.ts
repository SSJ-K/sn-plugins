// ==highlight== in the editor: the Markdown parser has no node for it, so a
// small scan of the visible lines draws iA's tan band behind the text and
// greys the == marks (they stay visible; iA never hides marks).
import {EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {RangeSetBuilder, EditorState} from '@codemirror/state';
import {syntaxTree} from '@codemirror/language';
import {hideMarksField, linesWithCursor, setHideMarks} from './marks';

const band = Decoration.mark({class: 'dw-hl'});
const markDeco = Decoration.mark({class: 'dw-mark dw-hlmark'});
const hiddenMark = Decoration.replace({});
const RE = /==([^=\n]+?)==/g;

// == inside inline code or a code block is code, not a highlight (preview agrees).
function inCode(state: EditorState, pos: number): boolean {
  for (let n = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
    if (n.name === 'InlineCode' || n.name === 'FencedCode' || n.name === 'CodeBlock') return true;
  }
  return false;
}

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const items: {from: number; to: number; d: Decoration}[] = [];
  // In hide-marks mode the == marks vanish off the cursor line, like every other mark.
  const hide = view.state.field(hideMarksField);
  const active = hide ? linesWithCursor(view.state) : null;
  for (const {from, to} of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    let m: RegExpExecArray | null;
    RE.lastIndex = 0;
    while ((m = RE.exec(text))) {
      const s = from + m.index;
      if (inCode(view.state, s)) continue;
      const deco = hide && !active.has(view.state.doc.lineAt(s).number) ? hiddenMark : markDeco;
      items.push({from: s, to: s + 2, d: deco});
      items.push({from: s + 2, to: s + 2 + m[1].length, d: band});
      items.push({from: s + 2 + m[1].length, to: s + m[0].length, d: deco});
    }
  }
  items.sort((a, c) => a.from - c.from);
  for (const it of items) b.add(it.from, it.to, it.d);
  return b.finish();
}

export const highlightExtension = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = build(view); }
  update(u: ViewUpdate) {
    const toggled = u.transactions.some(tr => tr.effects.some(e => e.is(setHideMarks)));
    const reparsed = syntaxTree(u.state) !== syntaxTree(u.startState); // code spans arrive with the background parse
    if (u.docChanged || u.viewportChanged || u.selectionSet || toggled || reparsed) this.decorations = build(u.view);
  }
}, {decorations: v => v.decorations});
