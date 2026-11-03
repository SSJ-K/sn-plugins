// Duo Writer entry: a tools row (shown by default, toggle remembered in the
// plugin's own settings) above the CodeMirror writing surface, wired to
// Standard Notes through sn-extension-api.
import './index.css';
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import snApi from 'sn-extension-api';
import {createEditor} from './editor';
import Toolbar from './Toolbar';

type Editor = ReturnType<typeof createEditor>;

const App = () => {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const [toolsOpen, setToolsOpen] = useState<boolean>(snApi.extensionMeta?.toolbar !== false);
  const [selectionTick, setSelectionTick] = useState(0);
  const [findFocusTick, setFindFocusTick] = useState(0);
  const toolsOpenRef = useRef(toolsOpen);
  toolsOpenRef.current = toolsOpen;

  const toggleTools = () => {
    const next = !toolsOpenRef.current;
    setToolsOpen(next);
    snApi.extensionMeta = {...(snApi.extensionMeta || {}), toolbar: next};
  };

  useEffect(() => {
    const text = snApi.text ?? '';
    const editor = createEditor(host.current, text, {
      onChange: (newText) => { snApi.text = newText; },
      onSelectionChange: () => setSelectionTick(t => t + 1),
      onFind: () => { if (!toolsOpenRef.current) toggleTools(); setFindFocusTick(t => t + 1); },
      onToggleTools: toggleTools
    });
    editor.setLocked(!!snApi.locked);
    editorRef.current = editor;
    setReady(true);
    const unsubscribe = snApi.subscribe(() => {
      editor.setText(snApi.text ?? '');
      editor.setLocked(!!snApi.locked);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  return (
    <div className={'dw-app' + (toolsOpen ? ' dw-tools-open' : '')}>
      <button type="button" className="dw-toggle" title="Show or hide tools (Cmd+.)"
              onMouseDown={(e) => e.preventDefault()} onClick={toggleTools}>{toolsOpen ? '–' : '+'}</button>
      {ready && toolsOpen && <Toolbar view={editorRef.current.view} selectionTick={selectionTick} findFocusTick={findFocusTick}/>}
      <div className="dw-host" ref={host}/>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
let mounted = false;

snApi.initialize({debounceSave: 400});

// Mount once the first note has arrived; later notes flow through subscribe inside App.
snApi.subscribe(() => {
  if (mounted) return;
  mounted = true;
  root.render(<App/>);
});
