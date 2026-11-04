// The tools row. Tools sit in a fixed priority order; the row measures its
// own width and shows as many as fit, the rest go under a "more" button.
// Nothing is ever hidden off-screen (lesson from 0.3.0 on the Mac).
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {EditorView} from '@codemirror/view';
import {I} from './icons';
import {
  headingLevelAtCursor, setHeading, toggleMark, toggleBullet, toggleChecklist, toggleQuote,
  toggleNumbered, insertLink, toggleCodeBlock, insertTable, insertDivider, clearFormatting,
  headings, jumpTo, insertCalendarWeek, insertToday, calendarWeek
} from './commands';
import {setFindQuery, findNext, countMatches, findQueryField} from './find';

interface Props {
  view: EditorView;
  undo: () => boolean;
  redo: () => boolean;
  selectionTick: number;      // bumps on every selection change, to refresh the heading picker
  findFocusTick: number;      // bumps when Cmd+F is pressed
  onSizeStep: (delta: number) => void;
}

interface Tool {
  key: string;
  group: number;        // separators are drawn between groups
  label: string;
  title: string;
  icon?: () => any;
  text?: string;        // text button instead of an icon
  run: () => any;
  active?: boolean;
  picker?: boolean;     // the heading picker, wider than a button
}

const Toolbar = ({view, undo, redo, selectionTick, findFocusTick, onSizeStep}: Props) => {
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [visible, setVisible] = useState(99);
  const findInput = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const level = headingLevelAtCursor(view.state);

  useEffect(() => { if (findFocusTick > 0) setFindOpen(true); }, [findFocusTick]);
  useEffect(() => { if (findOpen) findInput.current?.focus(); }, [findOpen, findFocusTick]);
  // Any click or move in the note closes the panels.
  useEffect(() => { if (tocOpen) setTocOpen(false); if (moreOpen) setMoreOpen(false); }, [selectionTick]);

  useEffect(() => {
    if (view.state.field(findQueryField) !== query) view.dispatch({effects: setFindQuery.of(query)});
    setCount(countMatches(view.state));
  }, [query, selectionTick]);

  const closeFind = () => {
    setFindOpen(false);
    setQuery('');
    view.dispatch({effects: setFindQuery.of('')});
    view.focus();
  };

  const onFindKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); findNext(view, e.shiftKey); }
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  };

  const keep = (e: Event) => e.preventDefault(); // keep the editor's focus and selection
  const openFind = () => { setFindOpen(true); findInput.current?.focus(); };

  // Priority order: most used first. Everything after what fits goes under "more".
  const tools: Tool[] = [
    {key: 'toc', group: 0, label: 'Table of contents', title: 'Table of contents', icon: I.toc, run: () => setTocOpen(o => !o), active: tocOpen},
    {key: 'cw', group: 9, label: 'Insert calendar week', title: 'Insert calendar week, Sunday start (Cmd+Shift+W)', text: calendarWeek(), run: () => insertCalendarWeek(view)},
    {key: 'date', group: 9, label: 'Insert today', title: 'Insert today as MM/DD/YYYY (Cmd+Shift+D)', text: 'Date', run: () => insertToday(view)},
    {key: 'bold', group: 3, label: 'Bold', title: 'Bold (Cmd+B)', icon: I.bold, run: () => toggleMark('**')(view)},
    {key: 'italic', group: 3, label: 'Italic', title: 'Italic (Cmd+I)', icon: I.italic, run: () => toggleMark('*')(view)},
    {key: 'highlight', group: 3, label: 'Highlight', title: 'Highlight (Cmd+Shift+H, or type = over a selection)', icon: I.highlight, run: () => toggleMark('==')(view)},
    {key: 'bullets', group: 4, label: 'Bullet list', title: 'Bullet list (Cmd+Shift+8)', icon: I.bullets, run: () => toggleBullet(view)},
    {key: 'checks', group: 4, label: 'Checklist', title: 'Checklist (Cmd+Shift+9)', icon: I.checks, run: () => toggleChecklist(view)},
    {key: 'undo', group: 1, label: 'Undo', title: 'Undo (Cmd+Z)', icon: I.undo, run: undo},
    {key: 'redo', group: 1, label: 'Redo', title: 'Redo (Cmd+Shift+Z)', icon: I.redo, run: redo},
    {key: 'find', group: 5, label: 'Find in note', title: 'Find in note (Cmd+F)', icon: I.search, run: openFind, active: findOpen},
    {key: 'link', group: 3, label: 'Link', title: 'Link (Cmd+K)', icon: I.link, run: () => insertLink(view)},
    {key: 'numbers', group: 4, label: 'Numbered list', title: 'Numbered list (Cmd+Shift+7)', icon: I.numbers, run: () => toggleNumbered(view)},
    {key: 'quote', group: 6, label: 'Quote', title: "Quote (Cmd+')", icon: I.quote, run: () => toggleQuote(view)},
    {key: 'code', group: 3, label: 'Inline code', title: 'Inline code (Cmd+E)', icon: I.code, run: () => toggleMark('`')(view)},
    {key: 'strike', group: 3, label: 'Strikethrough', title: 'Strikethrough (Cmd+Shift+X)', icon: I.strike, run: () => toggleMark('~~')(view)},
    {key: 'codeblock', group: 6, label: 'Code block', title: 'Code block (Cmd+Shift+C)', icon: I.codeBlock, run: () => toggleCodeBlock(view)},
    {key: 'table', group: 6, label: 'Table', title: 'Insert table', icon: I.table, run: () => insertTable(view)},
    {key: 'divider', group: 6, label: 'Divider', title: 'Insert divider', icon: I.divider, run: () => insertDivider(view)},
    {key: 'clear', group: 7, label: 'Clear formatting', title: 'Clear formatting', icon: I.clear, run: () => clearFormatting(view)},
    {key: 'bigger', group: 8, label: 'Bigger text', title: 'Bigger text (Cmd+Option+=)', icon: I.textBigger, run: () => onSizeStep(1)},
    {key: 'smaller', group: 8, label: 'Smaller text', title: 'Smaller text (Cmd+Option+-)', icon: I.textSmaller, run: () => onSizeStep(-1)},
    {key: 'heading', group: 10, label: 'Text style', title: 'Text style (Cmd+1 to Cmd+6, Cmd+Shift+0 body)', run: () => {}, picker: true},
    {key: 'resetsize', group: 8, label: 'Reset text size', title: 'Reset text size (Cmd+Option+0)', icon: I.textReset, run: () => onSizeStep(0)}
  ];

  // Measure: how many tools fit in the row, leaving room for "more" when needed.
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const btn = parseFloat(cs.getPropertyValue('--dw-btn')) || 32;
      const gap = parseFloat(cs.getPropertyValue('--dw-gap')) || 4;
      const avail = el.clientWidth - 16; // row padding
      const sepW = 9 + gap;
      const widths = tools.map((t, i) => (t.picker ? btn + 12 : t.text ? btn + 16 : btn) + gap + (i > 0 && t.group !== tools[i - 1].group ? sepW : 0));
      const all = widths.reduce((a, w) => a + w, 0);
      if (all <= avail) { setVisible(tools.length); return; }
      const moreW = sepW + btn + gap;
      let total = 0, n = 0;
      for (let i = 0; i < widths.length; i++) {
        if (total + widths[i] + moreW > avail) break;
        total += widths[i];
        n = i + 1;
      }
      setVisible(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = tools.slice(0, visible);
  const hidden = tools.slice(visible);

  const btn = (t: Tool) => (
    <button key={t.key} type="button" className={'dw-btn' + (t.active ? ' dw-active' : '') + (t.text ? ' dw-btn-text' : '')} title={t.title} aria-label={t.title}
            onMouseDown={keep} onClick={t.run}>{t.text ? t.text : <t.icon/>}</button>
  );

  const picker = (
    <span key="heading" className="dw-selectwrap" title="Text style (Cmd+1 to Cmd+6, Cmd+Shift+0 body)">
      <span className="dw-sellabel" aria-hidden="true">{level ? 'H' + level : '¶'}</span>
      <select className="dw-select" value={level} aria-label="Text style"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setHeading(Number((e.target as HTMLSelectElement).value))(view)}>
        <option value={0}>Body</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
        <option value={4}>Heading 4</option>
        <option value={5}>Heading 5</option>
        <option value={6}>Heading 6</option>
      </select>
      <span className="dw-chev"><I.chevron/></span>
    </span>
  );

  const rowItems: any[] = [];
  shown.forEach((t, i) => {
    if (i > 0 && t.group !== shown[i - 1].group) rowItems.push(<span key={'sep' + i} className="dw-sep" aria-hidden="true"/>);
    rowItems.push(t.picker ? picker : btn(t));
  });

  const toc = tocOpen ? headings(view.state) : [];

  return (
    <div className="dw-toolbar" role="toolbar" aria-label="Tools">
      <div className="dw-tools" ref={rowRef}>
        {rowItems}
        {hidden.length > 0 && (
          <>
            <span className="dw-sep" aria-hidden="true"/>
            <button type="button" className={'dw-btn' + (moreOpen ? ' dw-active' : '')} title="More tools" aria-label="More tools"
                    onMouseDown={keep} onClick={() => setMoreOpen(o => !o)}><I.more/></button>
          </>
        )}
      </div>
      {moreOpen && (
        <div className="dw-menu" onMouseDown={keep}>
          {hidden.map(t => t.picker ? (
            <div key={t.key} className="dw-menu-item dw-menu-picker">{picker}<span>Text style</span></div>
          ) : (
            <button key={t.key} type="button" className={'dw-menu-item' + (t.active ? ' dw-active' : '')}
                    onClick={() => { setMoreOpen(false); t.run(); }}>{t.text ? <b>{t.text}</b> : <t.icon/>}<span>{t.label}</span></button>
          ))}
        </div>
      )}
      {tocOpen && (
        <div className="dw-menu dw-toc" onMouseDown={keep}>
          {toc.length === 0 && <div className="dw-toc-empty">No headings yet</div>}
          {toc.map((h, i) => (
            <button key={i} type="button" className={'dw-menu-item dw-toc-l' + h.level}
                    onClick={() => { jumpTo(view, h.pos); setTocOpen(false); }}>{h.text || '(untitled)'}</button>
          ))}
        </div>
      )}
      {findOpen && (
        <div className="dw-find">
          <input ref={findInput} className="dw-find-input" type="search" placeholder="Find in note"
                 value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                 onKeyDown={onFindKey as any}/>
          <span className="dw-count">{query ? count : ''}</span>
          <button type="button" className="dw-btn" title="Previous (Shift+Enter)" aria-label="Previous" onMouseDown={keep} onClick={() => findNext(view, true)}><I.prev/></button>
          <button type="button" className="dw-btn" title="Next (Enter)" aria-label="Next" onMouseDown={keep} onClick={() => findNext(view)}><I.next/></button>
          <button type="button" className="dw-btn" title="Close (Esc)" aria-label="Close" onMouseDown={keep} onClick={closeFind}><I.close/></button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
