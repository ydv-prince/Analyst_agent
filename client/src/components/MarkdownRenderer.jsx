import React from 'react';

/**
 * Zero-dependency Markdown renderer for chat responses and dataset previews.
 * Handles headings, tables, codeblocks, inline code, bold, lists, and paragraphs.
 */
export function MarkdownRenderer({ content, isUser = false }) {
  if (!content) return null;

  // Split content into blocks: codeblocks, tables, and standard prose
  const lines = content.split('\n');
  const elements = [];
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Fenced Code Block: ```lang ... ```
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeText = codeLines.join('\n');
      elements.push(
        <div
          key={`code-${index++}`}
          className="my-3 rounded-xl border border-white/10 bg-black/40 overflow-hidden font-mono text-xs"
        >
          {language && (
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 text-white/50 text-[11px] font-semibold flex justify-between items-center">
              <span>{language}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/30">Code</span>
            </div>
          )}
          <pre className="p-3 text-indigo-200 overflow-x-auto leading-relaxed whitespace-pre font-mono">
            <code>{codeText}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Markdown Table: lines starting and ending with |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].trim().endsWith('|')) {
        i++;
        tableLines.push(lines[i]);
      }

      const rows = tableLines.map((l) =>
        l
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
      );

      // Distinguish header, delimiter, and body rows
      const headerRow = rows[0];
      const hasDelimiter = rows.length > 1 && rows[1].every((c) => /^:?-+:?$/.test(c));
      const bodyRows = hasDelimiter ? rows.slice(2) : rows.slice(1);

      elements.push(
        <div key={`table-${index++}`} className="my-3 overflow-x-auto">
          <table className="min-w-full text-xs border border-white/10 rounded-lg overflow-hidden border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="p-2.5 text-left font-bold text-white border-r border-white/10 last:border-r-0">
                    {parseInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-white/5 hover:bg-white/[0.02]">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-white/90 border-r border-white/5 last:border-r-0">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 3. Headings: #, ##, ###
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${index++}`} className="text-2xl font-bold font-display text-white mt-4 mb-2">
          {parseInline(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index++}`} className="text-xl font-bold font-display text-white mt-3 mb-1.5">
          {parseInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index++}`} className="text-lg font-bold font-display text-white mt-2.5 mb-1">
          {parseInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // 4. Bullet lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={`li-${index++}`} className="flex items-start space-x-2 my-1 text-sm text-white/90">
          <span className="text-brand-primary mt-1">•</span>
          <span>{parseInline(line.trim().slice(2))}</span>
        </div>
      );
      continue;
    }

    // 5. Empty lines
    if (!line.trim()) {
      elements.push(<div key={`sp-${index++}`} className="h-2" />);
      continue;
    }

    // 6. Regular prose paragraph
    elements.push(
      <p
        key={`p-${index++}`}
        className={`text-sm leading-relaxed my-1 ${
          isUser ? 'text-white' : 'text-white/90'
        }`}
      >
        {parseInline(line)}
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Parses inline markdown: bold (**text**), italics (*text*), and inline code (`code`).
 */
function parseInline(text) {
  if (!text) return '';

  // Split by inline code: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`code-${pIdx}`}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-black/40 text-indigo-300 font-mono text-xs border border-white/5"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Split by bold: **bold**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={`span-${pIdx}`}>
        {boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
            return (
              <strong key={`b-${bIdx}`} className="font-bold text-white">
                {bPart.slice(2, -2)}
              </strong>
            );
          }

          // Split by italics: *italic*
          const italicParts = bPart.split(/(\*[^*]+\*)/g);
          return (
            <React.Fragment key={`it-${bIdx}`}>
              {italicParts.map((iPart, iIdx) => {
                if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
                  return (
                    <em key={`i-${iIdx}`} className="italic text-white/95">
                      {iPart.slice(1, -1)}
                    </em>
                  );
                }
                return iPart;
              })}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  });
}

export default MarkdownRenderer;

