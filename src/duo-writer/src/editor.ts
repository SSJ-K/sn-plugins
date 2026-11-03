// The writing surface: CodeMirror 6 with Markdown parsing.
// Styling is kept to the minimum until step 2: headings larger, bold and
// italic drawn, everything else plain Duo S.
import {EditorState, Compartment} from '@codemirror/state';
import {EditorView, keymap, drawSelection} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {syntaxHighlighting, HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {setHeading, toggleMark, toggleBullet, toggleChecklist} from './commands';
import {findExtension} from './find';

const headingStyle = HighlightStyle.define([
  {tag: tags.heading1, fontSize: '1.6em', fontWeight: 'bold'},
  {tag: tags.heading2, fontSize: '1.3em', fontWeight: 'bold'},
  {tag: tags.heading3, fontSize: '1.1em', fontWeight: 'bold'},
  {tag: tags.heading4, fontWeight: 'bold'},
  {tag: tags.heading5, fontWeight: 'bold'},
  {tag: tags.heading6, fontWeight: 'bold'},
  {tag: tags.strong, fontWeight: 'bold'},
  {tag: tags.emphasis, fontStyle: 'italic'}
]);

export interface EditorHooks {
  onChange: (text: string) => void;
  onSelectionChange?: () => void;
  onFind?: () => void;        // Cmd+F: focus the find field
  onToggleTools?: () => void; // Cmd+.: show or hide the tools row
}

export function createEditor(parent: HTMLElement, initialText: string, hooks: EditorHooks) {
  const editable = new Compartment();
  let applyingExternal = false;

  const toolKeymap = keymap.of([
    {key: 'Mod-b', run: toggleMark('**')},
    {key: 'Mod-i', run: toggleMark('*')},
    {key: 'Mod-0', run: setHeading(0)},
    {key: 'Mod-1', run: setHeading(1)},
    {key: 'Mod-2', run: setHeading(2)},
    {key: 'Mod-3', run: setHeading(3)},
    {key: 'Mod-Shift-8', run: toggleBullet},
    {key: 'Mod-Shift-9', run: toggleChecklist},
    {key: 'Mod-f', run: () => { hooks.onFind?.(); return true; }},
    {key: 'Mod-.', run: () => { hooks.onToggleTools?.(); return true; }}
  ]);

  const state = EditorState.create({
    doc: initialText,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({base: markdownLanguage}),
      syntaxHighlighting(headingStyle),
      findExtension,
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

  return {
    view,
    setText(text: string) {
      const current = view.state.doc.toString();
      if (current === text) return;
      applyingExternal = true;
      view.dispatch({changes: {from: 0, to: current.length, insert: text}});
      applyingExternal = false;
    },
    setLocked(locked: boolean) {
      view.dispatch({effects: editable.reconfigure(EditorView.editable.of(!locked))});
    }
  };
}
