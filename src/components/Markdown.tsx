import React from 'react';

/**
 * Tiny, safe Markdown renderer (no HTML injection): headings, lists,
 * [ ] / [x] checklists, **bold**, *italic*, `code`, ``` blocks and links.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) {
      out.push(
        <code key={k} className="px-1 py-0.5 rounded bg-[#F1F3F4] dark:bg-[#282A2C] font-mono text-[0.9em]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith('**')) {
      out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    } else {
      const md = /^\[([^\]]+)\]\((.+)\)$/.exec(tok);
      const href = md ? md[2] : tok;
      out.push(
        <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="hub-text-accent underline break-all">
          {md ? md[1] : tok}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const Markdown: React.FC<{
  text: string;
  onToggleCheck?: (lineIndex: number) => void;
  className?: string;
}> = ({ text, onToggleCheck, className = '' }) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={`pre-${i}`} className="rounded-lg bg-[#F1F3F4] dark:bg-[#282A2C] p-2 overflow-x-auto font-mono text-xs">
          {body.join('\n')}
        </pre>
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(
        <p key={`h-${i}`} className={`font-semibold ${h[1].length === 1 ? 'text-base' : 'text-sm'}`}>
          {inline(h[2], `h${i}`)}
        </p>
      );
      i++;
      continue;
    }
    const check = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (check) {
      const idx = i;
      const done = check[1].toLowerCase() === 'x';
      blocks.push(
        <label key={`c-${i}`} className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={done}
            disabled={!onToggleCheck}
            onChange={() => onToggleCheck?.(idx)}
            className="mt-1 w-3.5 h-3.5 accent-[var(--hub-accent)]"
          />
          <span className={done ? 'line-through opacity-60' : ''}>{inline(check[2], `c${i}`)}</span>
        </label>
      );
      i++;
      continue;
    }
    const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      blocks.push(
        <p key={`li-${i}`} className="pl-3 relative before:content-['•'] before:absolute before:left-0 before:opacity-60">
          {inline(li[1], `l${i}`)}
        </p>
      );
      i++;
      continue;
    }
    blocks.push(
      line.trim() === '' ? <div key={`sp-${i}`} className="h-2" /> : <p key={`p-${i}`}>{inline(line, `p${i}`)}</p>
    );
    i++;
  }
  return <div className={`text-sm space-y-0.5 break-words ${className}`}>{blocks}</div>;
};

/** Toggle the Nth line's checklist box in markdown source. */
export function toggleMarkdownCheck(text: string, lineIndex: number): string {
  const lines = text.split('\n');
  lines[lineIndex] = lines[lineIndex].replace(/\[( |x|X)\]/, (m) => (m === '[ ]' ? '[x]' : '[ ]'));
  return lines.join('\n');
}
