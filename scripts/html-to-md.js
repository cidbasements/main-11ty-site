const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  strongDelimiter: '**',
  emDelimiter: '*',
  hr: '---',
});

// Keep figure/figcaption as HTML — no markdown equivalent
td.keep(['figure', 'figcaption']);

// Remove empty or whitespace-only block elements entirely
td.addRule('emptyBlocks', {
  filter: (node) => {
    const tag = node.nodeName.toLowerCase();
    if (!['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tag)) return false;
    return node.textContent.replace(/\u00a0/g, '').trim() === '';
  },
  replacement: () => '',
});

// Strip inline spans (e.g. <span style="line-height:1.5em">)
td.addRule('stripSpan', {
  filter: 'span',
  replacement: (content) => content,
});

// Strip <br> at end of content blocks — just use blank line separation
td.addRule('stripBr', {
  filter: 'br',
  replacement: () => '\n',
});

const blogDir = path.join(__dirname, '../src/content/blog');
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filePath = path.join(blogDir, file);
  const raw = fs.readFileSync(filePath, 'utf8');

  // Split frontmatter from body
  const match = raw.match(/^(---[\s\S]*?---\n)([\s\S]*)$/);
  if (!match) {
    console.log(`Skipping ${file} — no frontmatter found`);
    continue;
  }

  const frontmatter = match[1];
  const body = match[2];

  // Skip files with no HTML tags (already clean markdown)
  if (!/<[a-zA-Z]/.test(body)) {
    console.log(`Skipping ${file} — no HTML found`);
    continue;
  }

  // Pre-process: decode &amp; in non-link contexts so turndown doesn't double-escape
  // (turndown handles this internally so we leave it alone)

  let md = td.turndown(body.trim());

  // Post-process: collapse 3+ consecutive blank lines to 2
  md = md.replace(/\n{3,}/g, '\n\n');

  // Remove &nbsp; remnants
  md = md.replace(/&nbsp;/g, '');

  // Trim trailing whitespace from lines
  md = md.split('\n').map(l => l.trimEnd()).join('\n');

  fs.writeFileSync(filePath, frontmatter + '\n' + md + '\n');
  console.log(`Converted: ${file}`);
}

console.log('\nDone.');
