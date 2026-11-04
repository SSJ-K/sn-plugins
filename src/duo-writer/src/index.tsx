// Duo Writer entry: tools row (shown by default) above the CodeMirror
// writing surface, wired to Standard Notes through sn-extension-api.
// The plugin's own settings (synced, never the note) hold toolbar, hideMarks, sizeSteps and previewNotes.
import './index.css';
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import snApi from 'sn-extension-api';
import {createEditor} from './editor';
import Toolbar from './Toolbar';
import {I} from './icons';
import {renderPreview} from './preview';

type Editor = ReturnType<typeof createEditor>;

// Screen class by frame width: the same bands as the base text size in index.css.
type ScreenClass = 'narrow' | 'medium' | 'wide';
const screenClass = (): ScreenClass => window.innerWidth < 520 ? 'narrow' : window.innerWidth < 900 ? 'medium' : 'wide';
const MIN_STEP = -3, MAX_STEP = 6; // iA has 12 sizes; each step here is 10 percent

// shortcut: sn-extension-api 0.4 keeps the note's id in a private field; if an upgrade renames it,
// preview memory stops working (notes open in edit mode) and needs the new name.
const noteId = (): string | undefined => (snApi as any).lastStreamedItem?.uuid;

const App = () => {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const [toolsOpen, setToolsOpen] = useState<boolean>(snApi.extensionMeta?.toolbar !== false);
  const [hideMarks, setHideMarks] = useState<boolean>(snApi.extensionMeta?.hideMarks === true);
  const [selectionTick, setSelectionTick] = useState(0);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const previewRef = useRef(false);
  previewRef.current = preview;
  const [sizeSteps, setSizeSteps] = useState<Record<string, number>>(snApi.extensionMeta?.sizeSteps || {});
  const [screen, setScreen] = useState<ScreenClass>(screenClass());
  const sizeStepsRef = useRef(sizeSteps);
  sizeStepsRef.current = sizeSteps;
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

  const sizeStep = (delta: number) => {
    const cls = screenClass();
    const cur = sizeStepsRef.current[cls] || 0;
    const next = delta === 0 ? 0 : Math.max(MIN_STEP, Math.min(MAX_STEP, cur + delta));
    const all = {...sizeStepsRef.current, [cls]: next};
    setSizeSteps(all);
    remember({sizeSteps: all});
  };

  // Preview mode is remembered per note in the plugin's settings, listing only the notes left in preview.
  // Not in the note: the app counts every plugin save to a note as an edit and moves its modified date.
  // shortcut: entries for deleted notes stay in the list; prune them if it ever grows long.
  const setPreviewMode = (next: boolean, persist: boolean) => {
    if (next) setPreviewHtml(renderPreview(editorRef.current?.view.state.doc.toString() ?? ''));
    setPreview(next);
    if (!next) setTimeout(() => editorRef.current?.view.focus(), 0);
    const id = noteId();
    if (persist && id) {
      const notes = {...(snApi.extensionMeta?.previewNotes || {})};
      if (next) notes[id] = true; else delete notes[id];
      remember({previewNotes: notes});
    }
  };
  const togglePreview = () => setPreviewMode(!previewRef.current, true);

  useEffect(() => {
    const onResize = () => setScreen(screenClass());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const text = snApi.text ?? '';
    const editor = createEditor(host.current, text, {
      onChange: (newText) => { snApi.text = newText; },
      onSelectionChange: () => setSelectionTick(t => t + 1),
      onFind: () => { if (!toolsOpenRef.current) toggleTools(); setFindFocusTick(t => t + 1); },
      onToggleTools: toggleTools,
      onToggleMarks: toggleMarks,
      onSizeStep: sizeStep,
      onTogglePreview: togglePreview
    });
    editor.setLocked(!!snApi.locked);
    editor.setHideMarks(hideMarksRef.current);
    editorRef.current = editor;
    setReady(true);
    if (snApi.extensionMeta?.previewNotes?.[noteId()] === true) setPreviewMode(true, false);
    // TEMPORARY (0.8.3): status line for the iPad first-open freeze (K's screenshots); remove with the fix.
    const diag = document.createElement('div');
    diag.style.cssText = 'position:fixed;left:8px;bottom:6px;z-index:10;pointer-events:none;font:11px/1.3 -apple-system,system-ui,sans-serif;color:#888';
    document.body.appendChild(diag);
    const t0 = Date.now();
    let taps = 0, kind = '-';
    const yn = (b: boolean) => b ? 'Y' : 'N';
    const show = () => {
      const cd = editor.view.contentDOM, a = document.activeElement, s = window.getSelection();
      diag.textContent = `diag 0.8.3 · t ${Math.round((Date.now() - t0) / 1000)}s · page ${yn(document.hasFocus())} · editor ${yn(editor.view.hasFocus)}` +
        ` · active ${a ? a.tagName + (a.className ? '.' + String(a.className).split(' ')[0] : '') : '-'} · ${document.visibilityState}` +
        ` · taps ${taps} (${kind}) · domSel ${yn(!!s && s.rangeCount > 0 && cd.contains(s.anchorNode))} · editable ${cd.contentEditable}`;
    };
    document.addEventListener('pointerdown', (e) => { if (editor.view.contentDOM.contains(e.target as Node)) { taps++; kind = e.pointerType; } show(); }, true);
    for (const type of ['pointerup', 'focusin', 'focusout', 'visibilitychange', 'selectionchange']) document.addEventListener(type, show, true);
    window.addEventListener('focus', show);
    window.addEventListener('blur', show);
    setInterval(show, 1000);
    show();
    const unsubscribe = snApi.subscribe(() => {
      editor.setText(snApi.text ?? '');
      editor.setLocked(!!snApi.locked);
      if (previewRef.current) setPreviewHtml(renderPreview(snApi.text ?? ''));
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const step = sizeSteps[screen] || 0;
  const scale = Math.pow(1.1, step);

  return (
    <div className={'dw-app' + (toolsOpen ? ' dw-tools-open' : '')} style={{'--dw-scale': String(scale)} as any}>
      <div className="dw-corner">
        <button type="button" className={'dw-btn dw-play' + (preview ? ' dw-play-on' : '')}
                title={preview ? 'Back to editing (Cmd+Option+P)' : 'Preview (Cmd+Option+P)'} aria-label="Preview"
                onMouseDown={(e) => e.preventDefault()} onClick={togglePreview}>{preview ? <I.edit/> : <I.play/>}</button>
        <button type="button" className={'dw-btn' + (hideMarks ? ' dw-active' : '')}
                title={hideMarks ? 'Show Markdown marks (Cmd+Shift+.)' : 'Hide Markdown marks off the current line (Cmd+Shift+.)'}
                aria-label="Show or hide Markdown marks" onMouseDown={(e) => e.preventDefault()} onClick={toggleMarks}>
          {hideMarks ? <I.eyeOff/> : <I.eye/>}
        </button>
        <button type="button" className={'dw-btn' + (toolsOpen ? ' dw-active' : '')}
                title={toolsOpen ? 'Hide tools (Cmd+.)' : 'Show tools (Cmd+.)'}
                aria-label="Show or hide tools" onMouseDown={(e) => e.preventDefault()} onClick={toggleTools}><I.tools/></button>
      </div>
      {ready && toolsOpen && !preview && (
        <Toolbar view={editorRef.current.view} undo={editorRef.current.undo} redo={editorRef.current.redo}
                 selectionTick={selectionTick} findFocusTick={findFocusTick} onSizeStep={sizeStep}/>
      )}
      <div className="dw-host" ref={host} hidden={preview}/>
      {preview && <div className="dw-preview"><div className="dw-preview-page" dangerouslySetInnerHTML={{__html: previewHtml}}/></div>}
    </div>
  );
};

// Dark Standard Notes theme detection: the app injects the active theme's stylesheet into
// this frame, which redefines --sn-stylekit-background-color. Dark background => dark palette.
function syncThemeDarkness() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--sn-stylekit-background-color').trim();
  const m = bg.match(/^#([0-9a-f]{3,8})$/i);
  let dark = false;
  if (m) {
    let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
  } else if (/^rgb/.test(bg)) {
    const n = bg.match(/\d+/g)?.map(Number) || [];
    if (n.length >= 3) dark = (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) < 128;
  }
  if (dark) document.documentElement.setAttribute('data-dw-dark', ''); else document.documentElement.removeAttribute('data-dw-dark');
}
syncThemeDarkness();
// The injected theme is a <link>; its colours arrive when it finishes loading, after the
// DOM change. Re-check on every stylesheet load and for a few seconds after any head change.
const recheck = () => { syncThemeDarkness(); let n = 0; const t = setInterval(() => { syncThemeDarkness(); if (++n >= 20) clearInterval(t); }, 250); };
new MutationObserver((muts) => {
  recheck();
  for (const m of muts) for (const node of Array.from(m.addedNodes)) if (node instanceof HTMLLinkElement) node.addEventListener('load', syncThemeDarkness);
}).observe(document.head, {childList: true, subtree: true, attributes: true});
window.addEventListener('load', recheck);

const root = createRoot(document.getElementById('root'));
let mounted = false;

snApi.initialize({debounceSave: 250}); // a save still waiting dies with the frame on a note switch; keep the wait short

// Mount once the first note has arrived; later notes flow through subscribe inside App.
snApi.subscribe(() => {
  if (mounted) return;
  mounted = true;
  root.render(<App/>);
});
