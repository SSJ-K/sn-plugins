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

export function linesWithCursor(state: EditorState): Set<number> {
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
          // A bare or <...> address is the visible text itself, so it stays (K's email bug, 2026-11-05).
          const parent = node.node.parent?.name;
          if ((parent === 'Link' || parent === 'Image') && !active.has(state.doc.lineAt(node.from).number)) ranges.push({from: node.from, to: node.to});
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

// ---- Line layout: hanging marks and done checklist items ------------------
// iA Writer: heading marks hang in the left margin so the text keeps one
// left edge; list and quote continuation lines align with their text.
const LINE_START = /^(\s*)(#{1,6} |[-*+] (?:\[[ xX]\] )?|\d+\. |> )/;
const doneMark = Decoration.mark({class: 'dw-done'});
const hrLine = Decoration.line({class: 'dw-hr'});
const hrHidden = Decoration.replace({});
const taskMark = Decoration.mark({class: 'dw-task'});
const hashMark = Decoration.mark({class: 'dw-hashmark'});
const strongMark = Decoration.mark({class: 'dw-strongmark'});
const linkMark = Decoration.mark({class: 'dw-linkmark'});
const listMark = Decoration.mark({class: 'dw-listmark'});
const quoteMark = Decoration.mark({class: 'dw-quotemark'});

function layout(view: EditorView): DecorationSet {
  const {state} = view;
  const hide = state.field(hideMarksField);
  const active = hide ? linesWithCursor(state) : null;
  const cursorLines = active ?? linesWithCursor(state);
  // iA keeps heading marks inline when the pane is narrow (split phone screen)
  // and hangs them only when there is room; same breakpoint as the text size.
  const hangHeadings = view.dom.clientWidth >= 520;
  const b = new RangeSetBuilder<Decoration>();
  const items: {from: number; to: number; deco: Decoration}[] = [];
  const fenced = new Set<number>(); // line numbers inside fenced code: no hanging marks or list indents there
  syntaxTree(state).iterate({
    from: view.visibleRanges[0]?.from ?? 0,
    to: view.visibleRanges[view.visibleRanges.length - 1]?.to ?? 0,
    enter(node) {
      // Fenced code blocks: one grey box around the fence lines (iA: #f0f0f0, no vertical
      // padding, one-character overhang left and right, 0.17 em corners).
      // Divider (---, ***, ___): a full-width line; the dashes come back on the cursor line so it stays editable.
      if (node.name === 'HorizontalRule') {
        const line = state.doc.lineAt(node.from);
        if (!cursorLines.has(line.number)) {
          items.push({from: line.from, to: line.from, deco: hrLine});
          items.push({from: node.from, to: node.to, deco: hrHidden});
        }
        return;
      }
      if (node.name === 'FencedCode') {
        const first = state.doc.lineAt(node.from).number, last = state.doc.lineAt(node.to).number;
        for (let n = first; n <= last; n++) {
          fenced.add(n);
          const line = state.doc.line(n);
          const cls = 'dw-codeblock' + (n === first ? ' dw-codeblock-first' : '') + (n === last ? ' dw-codeblock-last' : '');
          items.push({from: line.from, to: line.from, deco: Decoration.line({class: cls})});
        }
        return;
      }
      // Mark kinds that iA draws differently from the generic grey.
      if (node.name === 'HeaderMark') { items.push({from: node.from, to: node.to, deco: hashMark}); return; }
      if (node.name === 'EmphasisMark' && node.to - node.from >= 2) { items.push({from: node.from, to: node.to, deco: strongMark}); return; }
      if (node.name === 'LinkMark') { items.push({from: node.from, to: node.to, deco: linkMark}); return; }
      if (node.name === 'ListMark') { items.push({from: node.from, to: node.to, deco: listMark}); return; }
      if (node.name === 'QuoteMark') { items.push({from: node.from, to: node.to, deco: quoteMark}); return; }
      // Done checklist items: strike the text after "[x] ".
      if (node.name !== 'Task') return;
      const marker = node.node.getChild('TaskMarker');
      if (!marker) return;
      const txt = state.sliceDoc(marker.from, marker.to);
      items.push({from: marker.from, to: marker.to, deco: taskMark});
      if (/x/i.test(txt) && marker.to < node.to) items.push({from: marker.to, to: node.to, deco: doneMark});
    }
  });
  for (const {from, to} of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      const m = LINE_START.exec(line.text);
      if (m && !fenced.has(line.number)) {
        const indent = m[1].length;
        const mark = m[2];
        const isHeading = mark.startsWith('#');
        if (isHeading) {
          // Hanging only while the marks are drawn; hidden marks leave the text flush.
          const marksDrawn = !hide || active.has(line.number);
          // Hang no more than the side margin holds (4.5ch, less a character of air): H1 to H3
          // hang fully; H4 to H6 hang the first three marks and keep the rest inline, as iA does.
          const hang = Math.min(mark.length, 3);
          if (marksDrawn && hangHeadings) items.push({from: line.from, to: line.from, deco: Decoration.line({attributes: {style: `text-indent:-${hang}ch`}})});
        } else {
          const w = indent + mark.length;
          items.push({from: line.from, to: line.from, deco: Decoration.line({attributes: {style: `padding-left:${w}ch;text-indent:-${w}ch`}})});
        }
      }
      pos = line.to + 1;
    }
  }
  items.sort((a, c) => a.from - c.from || (a.deco.spec.attributes ? -1 : c.deco.spec.attributes ? 1 : 0) || a.to - c.to);
  for (const it of items) b.add(it.from, it.to, it.deco);
  return b.finish();
}

const layoutPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = layout(view); }
  update(u: ViewUpdate) {
    const toggled = u.transactions.some(tr => tr.effects.some(e => e.is(setHideMarks)));
    const reparsed = syntaxTree(u.state) !== syntaxTree(u.startState);
    if (u.docChanged || u.viewportChanged || u.selectionSet || u.geometryChanged || toggled || reparsed) this.decorations = layout(u.view);
  }
}, {decorations: v => v.decorations});


// ---- Click or tap on a task marker toggles [ ] and [x] -------------------
const TASK_AT = /^(\s*[-*+] )\[( |x|X)\]/;
export const taskClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0) return false;
    const pos = view.posAtCoords({x: event.clientX, y: event.clientY});
    if (pos == null) return false;
    const line = view.state.doc.lineAt(pos);
    const m = TASK_AT.exec(line.text);
    if (!m) return false;
    const markFrom = line.from + m[1].length, markTo = markFrom + 3;
    // Accept a hit on the bullet or the box itself, not on the text after it.
    if (pos < line.from || pos > markTo) return false;
    const done = m[2] !== ' ';
    view.dispatch({changes: {from: markFrom, to: markTo, insert: done ? '[ ]' : '[x]'}});
    event.preventDefault();
    return true;
  }
});

export const layoutExtension = [layoutPlugin, taskClick];
