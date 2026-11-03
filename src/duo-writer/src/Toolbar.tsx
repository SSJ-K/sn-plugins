// The tools row: heading picker, bold, italic, bullet list, checklist, find.
// Plain Markdown actions, styled to sit quietly above the text.
import React, {useEffect, useRef, useState} from 'react';
import {EditorView} from '@codemirror/view';
import {headingLevelAtCursor, setHeading, toggleMark, toggleBullet, toggleChecklist} from './commands';
import {setFindQuery, findNext, countMatches, findQueryField} from './find';

interface Props {
  view: EditorView;
  selectionTick: number;      // bumps on every selection change, to refresh the heading picker
  findFocusTick: number;      // bumps when Cmd+F is pressed
}

const Toolbar = ({view, selectionTick, findFocusTick}: Props) => {
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(0);
  const findInput = useRef<HTMLInputElement>(null);

  const level = headingLevelAtCursor(view.state);

  // Cmd+F opens the field; the focus happens in the effect below, right after render.
  useEffect(() => {
    if (findFocusTick > 0) setFindOpen(true);
  }, [findFocusTick]);

  useEffect(() => {
    if (findOpen) findInput.current?.focus();
  }, [findOpen, findFocusTick]);

  useEffect(() => {
    if (view.state.field(findQueryField) !== query) {
      view.dispatch({effects: setFindQuery.of(query)});
    }
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

  const btn = (label: string, title: string, run: (v: EditorView) => boolean, active = false) => (
    <button type="button" className={'dw-btn' + (active ? ' dw-active' : '')} title={title}
            onMouseDown={(e) => e.preventDefault()} onClick={() => run(view)}>{label}</button>
  );

  return (
    <div className="dw-toolbar">
      <select className="dw-select" value={level} title="Heading (Cmd+0 to Cmd+3)"
              onChange={(e) => setHeading(Number((e.target as HTMLSelectElement).value))(view)}>
        <option value={0}>Body</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
      {btn('B', 'Bold (Cmd+B)', toggleMark('**'))}
      {btn('I', 'Italic (Cmd+I)', toggleMark('*'))}
      {btn('•', 'Bullet list (Cmd+Shift+8)', toggleBullet)}
      {btn('☐', 'Checklist (Cmd+Shift+9)', toggleChecklist)}
      {btn('Find', 'Find in note (Cmd+F)', () => { setFindOpen(true); findInput.current?.focus(); return true; }, findOpen)}
      {findOpen && (
        <span className="dw-find">
          <input ref={findInput} className="dw-find-input" type="search" placeholder="Find"
                 value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                 onKeyDown={onFindKey as any}/>
          <span className="dw-count">{query ? count : ''}</span>
          <button type="button" className="dw-btn" title="Previous (Shift+Enter)" onMouseDown={(e) => e.preventDefault()} onClick={() => findNext(view, true)}>‹</button>
          <button type="button" className="dw-btn" title="Next (Enter)" onMouseDown={(e) => e.preventDefault()} onClick={() => findNext(view)}>›</button>
          <button type="button" className="dw-btn" title="Close (Esc)" onMouseDown={(e) => e.preventDefault()} onClick={closeFind}>×</button>
        </span>
      )}
    </div>
  );
};

export default Toolbar;
