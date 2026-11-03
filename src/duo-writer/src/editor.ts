// The writing surface: CodeMirror 6 with Markdown parsing.
// Step 1 keeps styling to the minimum needed for the scroll gate test:
// headings drawn larger, everything else plain Duo S.
import {EditorState, Compartment} from '@codemirror/state';
import {EditorView, keymap, drawSelection} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {syntaxHighlighting, HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';

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

export function createEditor(parent: HTMLElement, initialText: string, onChange: (text: string) => void) {
  const editable = new Compartment();
  let applyingExternal = false;

  const state = EditorState.create({
    doc: initialText,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({base: markdownLanguage}),
      syntaxHighlighting(headingStyle),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      editable.of(EditorView.editable.of(true)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !applyingExternal) {
          onChange(update.state.doc.toString());
        }
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
