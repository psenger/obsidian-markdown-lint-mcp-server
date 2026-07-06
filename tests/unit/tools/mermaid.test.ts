import { jest } from '@jest/globals';
import { renderMermaidDiagrams, extractMermaidFromSvg } from '../../../src/tools/mermaid.js';
import { embedMermaidSource } from '../../../src/lib/svg-metadata.js';
import type { BrowserFactory, DiagramRenderer } from '../../../src/tools/mermaid.js';
import type { Browser } from 'puppeteer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOpts = any;

const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

function makeFakeRenderer(svgContent: string = MINIMAL_SVG): DiagramRenderer {
  return async (_browser: unknown, _source: unknown, _format: unknown, _opts: AnyOpts) => ({
    title: null,
    desc: null,
    data: Buffer.from(svgContent) as unknown as Uint8Array,
  });
}

function makeFakeBrowser(): Browser {
  return { close: jest.fn().mockResolvedValue(undefined) } as unknown as Browser;
}

function makeBrowserFactory(browser?: Browser): BrowserFactory {
  const b = browser ?? makeFakeBrowser();
  return async () => b;
}

describe('extractMermaidFromSvg', () => {
  it('returns source and code block for SVG with embedded metadata', () => {
    const source = 'flowchart LR\n  A --> B';
    const svgWithMeta = embedMermaidSource(MINIMAL_SVG, source);
    const result = extractMermaidFromSvg(svgWithMeta);
    expect(result.source).toBe(source);
    expect(result.mermaid_block).toBe('```mermaid\n' + source + '\n```');
    expect(result.error).toBeUndefined();
  });

  it('returns error for SVG with no embedded source', () => {
    const result = extractMermaidFromSvg(MINIMAL_SVG);
    expect(result.source).toBeNull();
    expect(result.mermaid_block).toBeNull();
    expect(result.error).toContain('No embedded Mermaid source');
  });

  it('returns error for empty string', () => {
    const result = extractMermaidFromSvg('');
    expect(result.source).toBeNull();
    expect(result.mermaid_block).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('preserves whitespace-sensitive mermaid source exactly', () => {
    const source = 'sequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi\n    note right of Bob: done';
    const svgWithMeta = embedMermaidSource(MINIMAL_SVG, source);
    const result = extractMermaidFromSvg(svgWithMeta);
    expect(result.source).toBe(source);
  });
});

describe('renderMermaidDiagrams', () => {
  it('returns unchanged content when there are no mermaid blocks', async () => {
    const content = '# Heading\n\nSome text without diagrams.\n';
    const result = await renderMermaidDiagrams(content, 'attachments', 'My Doc');
    expect(result.modified_content).toBe(content);
    expect(result.svgs).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('replaces mermaid block with GitHub image link on successful render', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `---\ntype: article\n---\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const browser = makeFakeBrowser();
    const result = await renderMermaidDiagrams(
      content,
      'attachments',
      'My Document',
      'default',
      'white',
      makeBrowserFactory(browser),
      makeFakeRenderer()
    );
    expect(result.svgs).toHaveLength(1);
    expect(result.modified_content).toContain('![flowchart diagram 1](attachments/my-document/flowchart-1.svg)');
    expect(result.modified_content).not.toContain('```mermaid');
  });

  it('adds mermaid_svg_source to front matter after rendering', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `---\ntype: article\n---\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const result = await renderMermaidDiagrams(
      content,
      'attachments',
      'My Doc',
      'default',
      'white',
      makeBrowserFactory(),
      makeFakeRenderer()
    );
    expect(result.modified_content).toContain('mermaid_svg_source: base64-embedded');
  });

  it('returns SVG data as base64 string with embedded metadata', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `# Doc\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const result = await renderMermaidDiagrams(
      content,
      'attachments',
      'Doc',
      'default',
      'white',
      makeBrowserFactory(),
      makeFakeRenderer()
    );
    expect(result.svgs[0].data).toBeTruthy();
    const decoded = Buffer.from(result.svgs[0].data, 'base64').toString('utf-8');
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('mermaid:source');
  });

  it('leaves failed blocks unchanged and reports error', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `# Doc\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const failingRenderer: DiagramRenderer = async () => {
      throw new Error('Render failed: syntax error');
    };
    const result = await renderMermaidDiagrams(
      content,
      'attachments',
      'Doc',
      'default',
      'white',
      makeBrowserFactory(),
      failingRenderer
    );
    expect(result.svgs).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('Render failed: syntax error');
    expect(result.errors[0].block_index).toBe(0);
    expect(result.modified_content).toContain('```mermaid');
  });

  it('does not update front matter when all renders fail', async () => {
    const source = 'bad syntax\n';
    const content = `---\ntype: article\n---\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const failingRenderer: DiagramRenderer = async () => {
      throw new Error('fail');
    };
    const result = await renderMermaidDiagrams(
      content, 'attachments', 'Doc', 'default', 'white',
      makeBrowserFactory(), failingRenderer
    );
    expect(result.modified_content).not.toContain('mermaid_svg_source');
  });

  it('slugifies document title in output path', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `# Doc\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const result = await renderMermaidDiagrams(
      content, 'attachments', 'My Complex Title 2026!',
      'default', 'white', makeBrowserFactory(), makeFakeRenderer()
    );
    expect(result.svgs[0].path).toContain('my-complex-title-2026');
  });

  it('folds accented characters to ASCII in the output path', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `# Doc\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const result = await renderMermaidDiagrams(
      content, 'attachments', 'Café Menu',
      'default', 'white', makeBrowserFactory(), makeFakeRenderer()
    );
    expect(result.svgs[0].path).toBe('attachments/cafe-menu/flowchart-1.svg');
  });

  it('falls back to "untitled" when the title has no ASCII slug characters', async () => {
    const source = 'flowchart LR\n  A --> B\n';
    const content = `# Doc\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const result = await renderMermaidDiagrams(
      content, 'attachments', '会議メモ',
      'default', 'white', makeBrowserFactory(), makeFakeRenderer()
    );
    expect(result.svgs[0].path).toBe('attachments/untitled/flowchart-1.svg');
    expect(result.svgs[0].path).not.toContain('//');
  });

  it('renders multiple mermaid blocks with sequential numbering', async () => {
    const block = '```mermaid\nflowchart LR\n  A --> B\n```';
    const content = `# Doc\n\n${block}\n\n${block}\n`;
    const result = await renderMermaidDiagrams(
      content, 'attachments', 'Doc',
      'default', 'white', makeBrowserFactory(), makeFakeRenderer()
    );
    expect(result.svgs).toHaveLength(2);
    expect(result.svgs[0].filename).toBe('flowchart-1.svg');
    expect(result.svgs[1].filename).toBe('flowchart-2.svg');
  });

  it('closes the browser even when a render fails', async () => {
    const browser = makeFakeBrowser();
    const source = 'flowchart LR\n  A --> B\n';
    const content = `# Doc\n\n\`\`\`mermaid\n${source}\`\`\`\n`;
    const failingRenderer: DiagramRenderer = async () => { throw new Error('fail'); };
    await renderMermaidDiagrams(
      content, 'attachments', 'Doc', 'default', 'white',
      makeBrowserFactory(browser), failingRenderer
    );
    expect((browser.close as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});
