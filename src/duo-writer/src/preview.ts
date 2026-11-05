// Preview mode: the note rendered the way iA Writer's preview draws it
// (measured 2026-11-03 from K's phone screenshots; spec section 13).
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import taskLists from 'markdown-it-task-lists';

// breaks: a new line in the editor is a new line in preview (K, 2026-11-05), not Markdown's joined paragraph.
const md = new MarkdownIt({html: false, linkify: true, typographer: false, breaks: true})
  .use(footnote)
  .use(mark)
  .use(taskLists, {enabled: false, label: true});

// A link followed inside the plugin frame replaces the editor; open it in a new window instead.
// Links to a place in the note (#...) stay in the frame.
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  if (!(tokens[idx].attrGet('href') || '').startsWith('#')) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener');
  }
  return self.renderToken(tokens, idx, options);
};

export function renderPreview(text: string): string {
  return md.render(text);
}

// Each block carries its first source line (from 0), so preview and editor can open at the same place.
// Space above a block comes only from the blank lines typed before it, one line each, as the editor shows
// (K, 2026-11-05); blocks have no margins of their own. A block starting on its container's first line
// (first list item, a table's rows) leaves the gap to the container.
md.core.ruler.push('source_line', state => {
  const lines = state.src.split('\n');
  const open: number[] = [];
  for (const t of state.tokens) {
    if (t.nesting === -1) { open.pop(); continue; }
    if (t.type === 'inline') continue;
    if (t.map) {
      t.attrSet('data-line', String(t.map[0]));
      let gap = 0;
      for (let i = t.map[0] - 1; i >= 0 && /^[\s>]*$/.test(lines[i]); i--) gap++;
      if (gap && open[open.length - 1] !== t.map[0]) t.attrSet('style', `margin-top:${gap * 1.56}em;margin-top:${gap}lh`);
    }
    if (t.nesting === 1) open.push(t.map ? t.map[0] : -1);
  }
});

// The fence renderer puts attributes on <code>; the gap belongs on <pre>.
const fence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const style = tokens[idx].attrGet('style');
  if (!style) return fence(tokens, idx, options, env, self);
  tokens[idx].attrs = tokens[idx].attrs!.filter(([k]) => k !== 'style');
  return fence(tokens, idx, options, env, self).replace('<pre>', `<pre style="${style}">`);
};

// The last block starting at or above `line`, or above the sheet's top edge; blocks come in source order.
function blockAt(box: HTMLElement, test: (el: HTMLElement) => boolean): HTMLElement | null {
  let found: HTMLElement | null = null;
  for (const el of Array.from(box.querySelectorAll<HTMLElement>('[data-line]'))) {
    if (!test(el)) break;
    found = el;
  }
  return found;
}

/** Scroll the preview sheet so the block holding source line `line` sits at its top. */
export function scrollPreviewTo(box: HTMLElement, line: number) {
  const el = blockAt(box, e => Number(e.dataset.line) <= line);
  // Line 0 keeps the page's top margin, as when preview opened at the top before.
  box.scrollTop = el && line > 0 ? box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top : 0;
}

/** The source line of the block at the top of the preview sheet. */
export function previewTopLine(box: HTMLElement): number {
  const top = box.getBoundingClientRect().top + 2; // 2 px slack for fractional scroll positions
  const el = blockAt(box, e => e.getBoundingClientRect().top <= top);
  return el ? Number(el.dataset.line) : 0;
}

// Self-check (runs once at load, console only): line tags, kept line breaks, and gaps only where lines were left blank.
if (typeof console !== 'undefined') {
  const html = renderPreview('# Title\n\n| a |\n|---|\n| 1 |\n| 2 |\n');
  if (!/<h1 data-line="0"/.test(html) || !/<tr data-line="5"/.test(html)) console.error('preview line-tag self-check failed', html);
  const spaced = renderPreview('## Head\nline one\nline two\n\n\nafter two blanks\n- item\n\n```\ncode\n```');
  const want = ['<h2 data-line="0">', 'line one<br>', '<p data-line="5" style="margin-top:3.12em;margin-top:2lh">', '<ul data-line="6">', '<pre style="margin-top:1.56em;margin-top:1lh"><code data-line="8">'];
  for (const w of want) if (!spaced.includes(w)) console.error('preview spacing self-check failed', w, spaced);
}
