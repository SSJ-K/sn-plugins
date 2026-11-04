// ==highlight== in the editor: the Markdown parser has no node for it, so a
// small scan of the visible lines draws iA's tan band behind the text and
// greys the == marks (they stay visible; iA never hides marks).
import {EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {RangeSetBuilder} from '@codemirror/state';

const band = Decoration.mark({class: 'dw-hl'});
const markDeco = Decoration.mark({class: 'dw-mark dw-hlmark'});
const RE = /==([^=\n]+?)==/g;

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const items: {from: number; to: number; d: Decoration}[] = [];
  for (const {from, to} of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    let m: RegExpExecArray | null;
    RE.lastIndex = 0;
    while ((m = RE.exec(text))) {
      const s = from + m.index;
      items.push({from: s, to: s + 2, d: markDeco});
      items.push({from: s + 2, to: s + 2 + m[1].length, d: band});
      items.push({from: s + 2 + m[1].length, to: s + m[0].length, d: markDeco});
    }
  }
  items.sort((a, c) => a.from - c.from);
  for (const it of items) b.add(it.from, it.to, it.d);
  return b.finish();
}

export const highlightExtension = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = build(view); }
  update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = build(u.view); }
}, {decorations: v => v.decorations});
