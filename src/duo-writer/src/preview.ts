// Preview mode: the note rendered the way iA Writer's preview draws it
// (measured 2026-11-03 from K's phone screenshots; spec section 13).
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import taskLists from 'markdown-it-task-lists';

const md = new MarkdownIt({html: false, linkify: true, typographer: false, breaks: false})
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
md.core.ruler.push('source_line', state => {
  for (const t of state.tokens) if (t.map && t.nesting !== -1 && t.type !== 'inline') t.attrSet('data-line', String(t.map[0]));
});

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

// Self-check of the line tags (runs once at load, console only): heading on line 0, last table row on line 5.
if (typeof console !== 'undefined') {
  const html = renderPreview('# Title\n\n| a |\n|---|\n| 1 |\n| 2 |\n');
  if (!/<h1 data-line="0"/.test(html) || !/<tr data-line="5"/.test(html)) console.error('preview line-tag self-check failed', html);
}
