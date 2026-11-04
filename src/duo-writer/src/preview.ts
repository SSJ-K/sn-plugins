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
