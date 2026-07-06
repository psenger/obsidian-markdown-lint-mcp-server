import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import { renderMermaid } from '@mermaid-js/mermaid-cli';
import type { ParseMDDOptions } from '@mermaid-js/mermaid-cli';
import { embedMermaidSource, extractMermaidSource } from '../lib/svg-metadata.js';
import { updateFrontMatter } from '../lib/frontmatter.js';

export interface MermaidRenderResult {
  modified_content: string;
  svgs: Array<{
    filename: string;
    path: string;
    data: string;
  }>;
  errors: Array<{
    block_index: number;
    source: string;
    error: string;
  }>;
}

export interface MermaidExtractResult {
  source: string | null;
  mermaid_block: string | null;
  error?: string;
}

// Injectable renderer type — default is the real mermaid-cli, overridden in tests
export type DiagramRenderer = (
  browser: Browser,
  source: string,
  format: 'svg',
  opts: ParseMDDOptions
) => Promise<{ title: string | null; desc: string | null; data: Uint8Array }>;

// Injectable browser factory — default is real Puppeteer, overridden in tests
export type BrowserFactory = () => Promise<Browser>;

/* istanbul ignore next */
const DEFAULT_BROWSER_FACTORY: BrowserFactory = () =>
  puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

/* istanbul ignore next */
const DEFAULT_RENDERER: DiagramRenderer = (browser, source, format, opts) =>
  renderMermaid(browser, source, format, opts);

const MERMAID_FENCE = /^```mermaid\s*\n([\s\S]*?)```/gm;

function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

function getDiagramType(source: string): string {
  const first = source.trim().split(/\s+/)[0]?.toLowerCase() ?? 'diagram';
  const typeMap: Record<string, string> = {
    flowchart: 'flowchart',
    graph: 'flowchart',
    sequencediagram: 'sequence',
    classdiagram: 'class',
    statediagram: 'state',
    'statediagram-v2': 'state',
    erdiagram: 'er',
    gantt: 'gantt',
    pie: 'pie',
    gitgraph: 'gitgraph',
    mindmap: 'mindmap',
    timeline: 'timeline',
    xychart: 'xychart',
    block: 'block',
    architecture: 'architecture',
  };
  return typeMap[first] ?? first;
}

export async function renderMermaidDiagrams(
  content: string,
  attachmentsDir: string,
  documentTitle: string,
  theme: string = 'default',
  background: string = 'white',
  _browserFactory: BrowserFactory = DEFAULT_BROWSER_FACTORY,
  _renderer: DiagramRenderer = DEFAULT_RENDERER
): Promise<MermaidRenderResult> {
  const titleSlug = slugify(documentTitle);
  const svgs: MermaidRenderResult['svgs'] = [];
  const errors: MermaidRenderResult['errors'] = [];

  const matches: Array<{ source: string; fullMatch: string; index: number }> = [];
  let match: RegExpExecArray | null;
  MERMAID_FENCE.lastIndex = 0;
  while ((match = MERMAID_FENCE.exec(content)) !== null) {
    matches.push({ source: match[1], fullMatch: match[0], index: matches.length });
  }

  if (matches.length === 0) {
    return { modified_content: content, svgs: [], errors: [] };
  }

  const browser = await _browserFactory();
  const typeCounts: Record<string, number> = {};
  const replacements = new Map<string, string>();

  try {
    for (const { source, fullMatch, index } of matches) {
      const diagramType = getDiagramType(source);
      typeCounts[diagramType] = (typeCounts[diagramType] ?? 0) + 1;
      const n = typeCounts[diagramType];
      const filename = `${diagramType}-${n}.svg`;
      const filePath = `${attachmentsDir}/${titleSlug}/${filename}`;

      try {
        const result = await _renderer(browser, source, 'svg', {
          mermaidConfig: { theme: theme as 'default' | 'dark' | 'neutral' | 'forest' },
          backgroundColor: background,
        });

        const svgText = Buffer.from(result.data).toString('utf-8');
        const svgWithMeta = embedMermaidSource(svgText, source);
        const svgBase64 = Buffer.from(svgWithMeta).toString('base64');

        svgs.push({ filename, path: filePath, data: svgBase64 });
        replacements.set(fullMatch, `![${diagramType} diagram ${n}](${filePath})`);
      } catch (err) {
        errors.push({
          block_index: index,
          source,
          error: (err as Error).message,
        });
      }
    }
  } finally {
    await browser.close();
  }

  let modified = content;
  for (const [original, replacement] of replacements) {
    modified = modified.replace(original, replacement);
  }

  if (svgs.length > 0) {
    modified = updateFrontMatter(modified, { mermaid_svg_source: 'base64-embedded' });
  }

  return { modified_content: modified, svgs, errors };
}

export function extractMermaidFromSvg(svgContent: string): MermaidExtractResult {
  try {
    const source = extractMermaidSource(svgContent);
    if (!source) {
      return {
        source: null,
        mermaid_block: null,
        error: 'No embedded Mermaid source found in SVG metadata',
      };
    }
    return {
      source,
      mermaid_block: '```mermaid\n' + source + '\n```',
    };
  } /* istanbul ignore next */ catch (err: unknown) {
    return { source: null, mermaid_block: null, error: (err as Error).message };
  }
}
