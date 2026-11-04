// The writing surface: CodeMirror 6 with Markdown parsing, iA-style
// in-place styling (headings, emphasis, links, code, quotes) with the marks
// in light grey, or hidden off the current line when "hide marks" is on.
import {EditorState, Compartment} from '@codemirror/state';
import {EditorView, keymap, drawSelection} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, undo, redo} from '@codemirror/commands';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {syntaxHighlighting, HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {setHeading, toggleMark, toggleBullet, toggleChecklist, toggleQuote, toggleNumbered, insertLink, toggleCodeBlock} from './commands';
import {findExtension} from './find';
import {marksExtension, setHideMarks, layoutExtension} from './marks';
import {highlightExtension} from './highlight';

const duoStyle = HighlightStyle.define([
  // iA Writer draws headings at body size, with the # marks hanging in the margin.
  // Weight 650 is iA's "Semibold" instance; measured heading stroke 8.9 px against 9.5 at 700.
  {tag: tags.heading1, fontWeight: '650'},
  {tag: tags.heading2, fontWeight: '650'},
  {tag: tags.heading3, fontWeight: '650'},
  {tag: tags.heading4, fontWeight: '650'},
  {tag: tags.heading5, fontWeight: '650'},
  {tag: tags.heading6, fontWeight: '650'},
  {tag: tags.strong, fontWeight: '650'},
  {tag: tags.emphasis, fontStyle: 'italic'},
  {tag: tags.strikethrough, textDecoration: 'line-through'},
  {tag: tags.processingInstruction, class: 'dw-mark'},   // #, *, **, ~~, `, [, ], (, ), >
  {tag: tags.atom, class: 'dw-mark'},                    // task markers [ ] [x]
  {tag: tags.link, class: 'dw-link'},
  {tag: tags.url, class: 'dw-url'},
  {tag: tags.monospace, class: 'dw-code'},
  {tag: tags.quote, class: 'dw-quote'},
  {tag: tags.list, class: 'dw-list'},
  {tag: tags.contentSeparator, class: 'dw-rule'}
]);

export interface EditorHooks {
  onChange: (text: string) => void;
  onSelectionChange?: () => void;
  onFind?: () => void;        // Cmd+F: focus the find field
  onToggleTools?: () => void; // Cmd+.: show or hide the tools row
  onToggleMarks?: () => void; // Cmd+Shift+.: show or hide the marks
  onSizeStep?: (delta: number) => void;
  onTogglePreview?: () => void; // Cmd+R, as in iA Writer // Cmd+Option+= bigger, Cmd+Option+- smaller, Cmd+Option+0 reset
}

export function createEditor(parent: HTMLElement, initialText: string, hooks: EditorHooks) {
  const editable = new Compartment();
  let applyingExternal = false;

  const toolKeymap = keymap.of([
    {key: 'Mod-b', run: toggleMark('**')},
    {key: 'Mod-i', run: toggleMark('*')},
    {key: 'Mod-Shift-x', run: toggleMark('~~')},
    {key: 'Mod-e', run: toggleMark('`')},
    {key: 'Mod-k', run: insertLink},
    {key: 'Mod-Shift-0', run: setHeading(0)}, // Cmd+0 is window zoom in the desktop app
    {key: 'Mod-1', run: setHeading(1)},
    {key: 'Mod-2', run: setHeading(2)},
    {key: 'Mod-3', run: setHeading(3)},
    {key: 'Mod-4', run: setHeading(4)},
    {key: 'Mod-5', run: setHeading(5)},
    {key: 'Mod-6', run: setHeading(6)},
    {key: 'Mod-Shift-8', run: toggleBullet},
    {key: 'Mod-Shift-7', run: toggleNumbered},
    {key: 'Mod-Shift-9', run: toggleChecklist},
    {key: "Mod-'", run: toggleQuote},
    {key: 'Mod-Shift-c', run: toggleCodeBlock},
    {key: 'Mod-f', run: () => { hooks.onFind?.(); return true; }},
    {key: 'Mod-.', run: () => { hooks.onToggleTools?.(); return true; }},
    {key: 'Mod-Shift-.', run: () => { hooks.onToggleMarks?.(); return true; }},
    // Cmd+= / Cmd+- / Cmd+0 belong to the desktop app's window zoom; Option keeps ours separate.
    {key: 'Mod-Alt-=', run: () => { hooks.onSizeStep?.(1); return true; }},
    {key: 'Mod-Alt--', run: () => { hooks.onSizeStep?.(-1); return true; }},
    {key: 'Mod-Alt-0', run: () => { hooks.onSizeStep?.(0); return true; }},
    {key: 'Mod-r', run: () => { hooks.onTogglePreview?.(); return true; }}
  ]);

  const state = EditorState.create({
    doc: initialText,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({base: markdownLanguage}),
      syntaxHighlighting(duoStyle),
      findExtension,
      marksExtension,
      layoutExtension,
      highlightExtension,
      toolKeymap,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      editable.of(EditorView.editable.of(true)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !applyingExternal) {
          hooks.onChange(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) hooks.onSelectionChange?.();
      })
    ]
  });

  const view = new EditorView({state, parent});
  (window as any).__dw = view; // diagnostics on the demo page

  return {
    view,
    undo: () => { undo(view); view.focus(); return true; },
    redo: () => { redo(view); view.focus(); return true; },
    setText(text: string) {
      const current = view.state.doc.toString();
      if (current === text) return;
      applyingExternal = true;
      view.dispatch({changes: {from: 0, to: current.length, insert: text}});
      applyingExternal = false;
    },
    setLocked(locked: boolean) {
      view.dispatch({effects: editable.reconfigure(EditorView.editable.of(!locked))});
    },
    setHideMarks(hide: boolean) {
      view.dispatch({effects: setHideMarks.of(hide)});
    }
  };
}
