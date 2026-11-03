// The tools row: every Super tool that plain Markdown can express, as thin
// line icons in groups. Scrolls sideways on a narrow screen instead of wrapping.
import React, {useEffect, useRef, useState} from 'react';
import {EditorView} from '@codemirror/view';
import {I} from './icons';
import {
  headingLevelAtCursor, setHeading, toggleMark, toggleBullet, toggleChecklist, toggleQuote,
  toggleNumbered, insertLink, toggleCodeBlock, insertTable, insertDivider, clearFormatting,
  headings, jumpTo
} from './commands';
import {setFindQuery, findNext, countMatches, findQueryField} from './find';

interface Props {
  view: EditorView;
  undo: () => boolean;
  redo: () => boolean;
  selectionTick: number;      // bumps on every selection change, to refresh the heading picker
  findFocusTick: number;      // bumps when Cmd+F is pressed
}

const Toolbar = ({view, undo, redo, selectionTick, findFocusTick}: Props) => {
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const findInput = useRef<HTMLInputElement>(null);

  const level = headingLevelAtCursor(view.state);

  useEffect(() => { if (findFocusTick > 0) setFindOpen(true); }, [findFocusTick]);
  // Any click or move in the note closes the table of contents.
  useEffect(() => { if (tocOpen) setTocOpen(false); }, [selectionTick]);
  useEffect(() => { if (findOpen) findInput.current?.focus(); }, [findOpen, findFocusTick]);

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

  const btn = (Icon: () => any, title: string, run: () => any, active = false) => (
    <button type="button" className={'dw-btn' + (active ? ' dw-active' : '')} title={title} aria-label={title}
            onMouseDown={keep} onClick={run}><Icon/></button>
  );
  const sep = () => <span className="dw-sep" aria-hidden="true"/>;

  const toc = tocOpen ? headings(view.state) : [];

  return (
    <div className="dw-toolbar" role="toolbar" aria-label="Tools">
      <div className="dw-tools">
        {btn(I.undo, 'Undo (Cmd+Z)', undo)}
        {btn(I.redo, 'Redo (Cmd+Shift+Z)', redo)}
        {sep()}
        <span className="dw-selectwrap" title="Text style (Cmd+0 to Cmd+6)">
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
        {sep()}
        {btn(I.bold, 'Bold (Cmd+B)', () => toggleMark('**')(view))}
        {btn(I.italic, 'Italic (Cmd+I)', () => toggleMark('*')(view))}
        {btn(I.strike, 'Strikethrough (Cmd+Shift+X)', () => toggleMark('~~')(view))}
        {btn(I.link, 'Link (Cmd+K)', () => insertLink(view))}
        {btn(I.code, 'Inline code (Cmd+E)', () => toggleMark('`')(view))}
        {sep()}
        {btn(I.bullets, 'Bullet list (Cmd+Shift+8)', () => toggleBullet(view))}
        {btn(I.numbers, 'Numbered list (Cmd+Shift+7)', () => toggleNumbered(view))}
        {btn(I.checks, 'Checklist (Cmd+Shift+9)', () => toggleChecklist(view))}
        {sep()}
        {btn(I.quote, "Quote (Cmd+')", () => toggleQuote(view))}
        {btn(I.codeBlock, 'Code block (Cmd+Shift+C)', () => toggleCodeBlock(view))}
        {btn(I.table, 'Insert table', () => insertTable(view))}
        {btn(I.divider, 'Insert divider', () => insertDivider(view))}
        {sep()}
        {btn(I.toc, 'Table of contents', () => setTocOpen(o => !o), tocOpen)}
        {btn(I.clear, 'Clear formatting', () => clearFormatting(view))}
        {sep()}
        {btn(I.search, 'Find in note (Cmd+F)', () => { setFindOpen(true); findInput.current?.focus(); }, findOpen)}
      </div>
      {tocOpen && (
        <div className="dw-toc" onMouseDown={keep}>
          {toc.length === 0 && <div className="dw-toc-empty">No headings yet</div>}
          {toc.map((h, i) => (
            <button key={i} type="button" className={'dw-toc-item dw-toc-l' + h.level}
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
          {btn(I.prev, 'Previous (Shift+Enter)', () => findNext(view, true))}
          {btn(I.next, 'Next (Enter)', () => findNext(view))}
          {btn(I.close, 'Close (Esc)', closeFind)}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
