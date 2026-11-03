// Duo Writer entry: tools row (shown by default) above the CodeMirror
// writing surface, wired to Standard Notes through sn-extension-api.
// Two per-user switches live in the plugin's own settings: toolbar, hideMarks.
import './index.css';
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import snApi from 'sn-extension-api';
import {createEditor} from './editor';
import Toolbar from './Toolbar';
import {I} from './icons';

type Editor = ReturnType<typeof createEditor>;

const App = () => {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const [toolsOpen, setToolsOpen] = useState<boolean>(snApi.extensionMeta?.toolbar !== false);
  const [hideMarks, setHideMarks] = useState<boolean>(snApi.extensionMeta?.hideMarks === true);
  const [selectionTick, setSelectionTick] = useState(0);
  const [findFocusTick, setFindFocusTick] = useState(0);
  const toolsOpenRef = useRef(toolsOpen);
  const hideMarksRef = useRef(hideMarks);
  toolsOpenRef.current = toolsOpen;
  hideMarksRef.current = hideMarks;

  const remember = (patch: object) => { snApi.extensionMeta = {...(snApi.extensionMeta || {}), ...patch}; };

  const toggleTools = () => {
    const next = !toolsOpenRef.current;
    setToolsOpen(next);
    remember({toolbar: next});
  };

  const toggleMarks = () => {
    const next = !hideMarksRef.current;
    setHideMarks(next);
    editorRef.current?.setHideMarks(next);
    remember({hideMarks: next});
  };

  useEffect(() => {
    const text = snApi.text ?? '';
    const editor = createEditor(host.current, text, {
      onChange: (newText) => { snApi.text = newText; },
      onSelectionChange: () => setSelectionTick(t => t + 1),
      onFind: () => { if (!toolsOpenRef.current) toggleTools(); setFindFocusTick(t => t + 1); },
      onToggleTools: toggleTools,
      onToggleMarks: toggleMarks
    });
    editor.setLocked(!!snApi.locked);
    editor.setHideMarks(hideMarksRef.current);
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
      <button type="button" className="dw-toggle" title={toolsOpen ? 'Hide tools (Cmd+.)' : 'Show tools (Cmd+.)'}
              aria-label="Show or hide tools" onMouseDown={(e) => e.preventDefault()} onClick={toggleTools}><I.tools/></button>
      {ready && toolsOpen && (
        <Toolbar view={editorRef.current.view} undo={editorRef.current.undo} redo={editorRef.current.redo}
                 selectionTick={selectionTick} findFocusTick={findFocusTick}
                 hideMarks={hideMarks} onToggleMarks={toggleMarks}/>
      )}
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
