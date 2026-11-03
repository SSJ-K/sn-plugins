export interface TestData {
  title: string;
  text: string;
  meta?: any;
}

const SAMPLE = {
  title: 'Sample',
  text: `# Measurement Sample

This paragraph exists to measure body text. It is long enough to wrap onto a second and a third line at every column width we care about, so the line height and the right margin can be read from the screenshot without guessing.

## Second Heading

A short paragraph with *italic words*, **bold words**, and ***both at once***. Then a [link to nowhere](https://example.com) and some \`inline code\` inside the sentence.

### Third Heading

- First list item
- Second list item that is deliberately long enough to wrap to a second line so the hanging indent of the bullet can be measured
- Third list item

- [ ] An open checklist item
- [x] A done checklist item

> A quoted line, to see how the bar and the indent are drawn.

Final paragraph after a blank line, to measure paragraph spacing. End.
`
};

// Gate test 2: a long note with many large headings, for scroll testing.
const longParts: string[] = [];
for (let i = 1; i <= 60; i++) {
  longParts.push(`# Heading ${i}\n\nParagraph ${i}. ` + 'Words that wrap across the column so every section has a few lines of body text. '.repeat(3) + `\n\n## Sub ${i}\n\n- item one\n- item two\n`);
}
const LONG = {
  title: 'Long (scroll test)',
  text: longParts.join('\n')
};

const EMPTY = {
  title: 'Empty',
  text: ''
};

export const TEST_DATA: TestData[] = [SAMPLE, LONG, EMPTY];
