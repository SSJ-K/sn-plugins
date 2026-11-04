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

export function renderPreview(text: string): string {
  return md.render(text);
}
