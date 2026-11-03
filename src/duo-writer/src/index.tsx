// Duo Writer entry: wires the CodeMirror editor to Standard Notes through
// sn-extension-api. Step 1 (shell): load text, edit, save, Duo S typeface.
import './index.css';
import snApi from 'sn-extension-api';
import {createEditor} from './editor';

const root = document.getElementById('root');
let editor: ReturnType<typeof createEditor> | null = null;

snApi.initialize({debounceSave: 400});

snApi.subscribe(() => {
  const text = snApi.text ?? '';
  if (!editor) {
    editor = createEditor(root, text, (newText) => {
      snApi.text = newText;
    });
  } else {
    editor.setText(text);
  }
  editor.setLocked(!!snApi.locked);
});
