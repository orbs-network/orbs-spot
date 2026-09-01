"use client";

import {
  CheckIcon,
  ClipboardIcon,
  Code2Icon,
  ExternalLinkIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "lucide-react";
import {
  Highlight,
  themes,
  type Language,
} from "prism-react-renderer";
import {
  Children,
  type ReactNode,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MarkdownBlock =
  | { code: string; language: string; type: "code" }
  | { level: number; text: string; type: "heading" }
  | { items: string[]; type: "list" }
  | { items: string[]; type: "orderedList" }
  | { rows: string[][]; type: "table" }
  | { text: string; type: "paragraph" };

const TOKEN_PATTERN = /(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;
const CODE_PATTERN = /^`([^`]+)`$/;
const SYNTAX_LANGUAGE_ALIASES: Readonly<Record<string, Language>> = {
  js: "javascript",
  sh: "bash",
  shell: "bash",
  text: "plain",
  ts: "typescript",
};

function parseTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(row: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(row);
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeStart = line.match(/^```([\w-]+)?\s*$/);
    if (codeStart) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({
        code: codeLines.join("\n"),
        language: codeStart[1] ?? "text",
        type: "code",
      });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        level: heading[1].length,
        text: heading[2],
        type: "heading",
      });
      index += 1;
      continue;
    }

    if (
      line.trim().startsWith("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      const rows = [parseTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ rows, type: "table" });
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "list" });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "orderedList" });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,4}\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*-\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("|")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ text: paragraph.join(" "), type: "paragraph" });
  }

  return blocks;
}

export function HighlightedText({
  query,
  text,
}: {
  query?: string;
  text: string;
}) {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) return text;

  const normalizedText = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark
        key={`${matchIndex}-${text.slice(matchIndex, matchIndex + normalizedQuery.length)}`}
        data-guide-search-highlight="true"
        className="rounded-sm bg-primary/25 text-inherit ring-1 ring-primary/35"
      >
        {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>,
    );
    cursor = matchIndex + normalizedQuery.length;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function renderInline(text: string, highlightQuery?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index === undefined) continue;
    if (match.index > cursor) {
      const plainText = text.slice(cursor, match.index);
      parts.push(
        <HighlightedText
          key={`plain-${cursor}`}
          query={highlightQuery}
          text={plainText}
        />,
      );
    }

    const token = match[0];
    const link = token.match(LINK_PATTERN);
    const code = token.match(CODE_PATTERN);

    if (link) {
      const external = /^https?:\/\//.test(link[2]);
      parts.push(
        <a
          key={`${token}-${match.index}`}
          href={link[2]}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          className="font-medium text-primary underline decoration-primary/45 underline-offset-4 transition-colors hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <HighlightedText query={highlightQuery} text={link[1]} />
          {external ? (
            <ExternalLinkIcon
              aria-hidden="true"
              className="ml-1 inline size-3 -translate-y-px"
            />
          ) : null}
        </a>,
      );
    } else if (code) {
      parts.push(
        <code
          key={`${token}-${match.index}`}
          className="box-decoration-clone break-words rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          <HighlightedText query={highlightQuery} text={code[1]} />
        </code>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    parts.push(
      <HighlightedText
        key={`plain-${cursor}`}
        query={highlightQuery}
        text={text.slice(cursor)}
      />,
    );
  }
  return parts;
}

export function CodeBlock({
  code,
  highlightQuery,
  language,
  limitHeight = false,
}: {
  code: string;
  highlightQuery?: string;
  language: string;
  limitHeight?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const syntaxLanguage = SYNTAX_LANGUAGE_ALIASES[language] ?? language;

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
      setFullscreenFailed(false);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const copyLabel =
    copyStatus === "copied"
      ? "Copied"
      : copyStatus === "failed"
        ? "Retry copy"
        : "Copy";

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      setFullscreenFailed(false);
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
        return;
      }

      if (document.fullscreenElement) await document.exitFullscreen();
      await container.requestFullscreen();
    } catch {
      setFullscreenFailed(true);
    }
  };

  const handleCodeWheel = (event: WheelEvent<HTMLPreElement>) => {
    if (isFullscreen || event.deltaY === 0) return;
    const scroller = event.currentTarget;
    const atTop = scroller.scrollTop <= 0;
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if ((event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom)) {
      return;
    }

    const previousScrollY = window.scrollY;
    window.scrollBy({ top: event.deltaY });
    if (window.scrollY !== previousScrollY) event.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className={`min-w-0 overflow-hidden rounded-[16px] border border-border/70 bg-background/35 shadow-inner ${
        isFullscreen
          ? "flex h-screen w-screen flex-col rounded-none border-0 bg-card"
          : ""
      }`}
    >
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-secondary/35 pl-4 pr-1.5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <Code2Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          <span className="truncate">{language}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {fullscreenFailed ? (
            <span
              role="status"
              className="max-w-40 truncate px-1 text-[10px] font-medium text-destructive"
            >
              Full screen unavailable
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void copyCode()}
            className="inline-flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={
              copyStatus === "copied"
                ? "Code copied"
                : copyStatus === "failed"
                  ? "Copy failed, retry"
                  : "Copy code"
            }
          >
            {copyStatus === "copied" ? (
              <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
            ) : (
              <ClipboardIcon aria-hidden="true" className="size-3.5" />
            )}
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit full screen" : "Open full screen"}
            aria-pressed={isFullscreen}
            className="inline-flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {isFullscreen ? (
              <Minimize2Icon aria-hidden="true" className="size-3.5" />
            ) : (
              <Maximize2Icon aria-hidden="true" className="size-3.5" />
            )}
            <span className="max-sm:hidden">
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </span>
          </button>
        </div>
      </div>
      <Highlight
        theme={themes.oneDark}
        code={code}
        language={syntaxLanguage}
      >
        {({ className, getLineProps, getTokenProps, style, tokens }) => (
          <pre
            className={`${className} max-w-full overflow-auto overscroll-x-contain overscroll-y-auto p-4 font-mono text-[12px] leading-5 sm:p-5 sm:text-[13px] sm:leading-6 ${
              isFullscreen
                ? "min-h-0 flex-1"
                : limitHeight
                  ? "max-h-[min(640px,72dvh)] max-sm:max-h-[min(520px,68dvh)]"
                  : ""
            }`}
            style={{ ...style, background: "transparent" }}
            aria-label={`${language} code snippet`}
            tabIndex={0}
            translate="no"
            onWheel={handleCodeWheel}
          >
            <code className="block w-max min-w-full">
              {Children.toArray(
                tokens.map((line, lineIndex) => {
                  const lineProps = getLineProps({ line });

                  return (
                    <span
                      key={`line-${lineIndex}`}
                      className={`${lineProps.className} flex min-w-full`}
                      style={lineProps.style}
                    >
                      <span
                        aria-hidden="true"
                        className="block w-8 shrink-0 select-none pr-4 text-right text-muted-foreground/45"
                      >
                        {lineIndex + 1}
                      </span>
                      <span className="block flex-1 whitespace-pre">
                        {Children.toArray(
                          line.map((token, tokenIndex) => {
                            const tokenProps = getTokenProps({ token });
                            const tokenClassName = token.types.includes(
                              "comment",
                            )
                              ? `${tokenProps.className} !text-foreground/75`
                              : tokenProps.className;

                            return (
                              <span
                                key={`token-${lineIndex}-${tokenIndex}`}
                                className={tokenClassName}
                                style={tokenProps.style}
                              >
                                <HighlightedText
                                  query={highlightQuery}
                                  text={token.content}
                                />
                              </span>
                            );
                          }),
                        )}
                      </span>
                    </span>
                  );
                }),
              )}
            </code>
          </pre>
        )}
      </Highlight>
      <span className="sr-only" aria-live="polite">
        {copyStatus === "copied"
          ? "Code copied to clipboard"
          : copyStatus === "failed"
            ? "Code could not be copied. Try again."
            : ""}
      </span>
    </div>
  );
}

export function MarkdownContent({
  codeBlocksFirst = false,
  highlightQuery,
  limitCodeBlockHeight = false,
  markdown,
}: {
  codeBlocksFirst?: boolean;
  highlightQuery?: string;
  limitCodeBlockHeight?: boolean;
  markdown: string;
}) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  const firstCodeIndex = blocks.findIndex((block) => block.type === "code");
  const orderedBlocks =
    codeBlocksFirst && firstCodeIndex > 0
      ? [
          blocks[firstCodeIndex],
          ...blocks.slice(0, firstCodeIndex),
          ...blocks.slice(firstCodeIndex + 1),
        ]
      : blocks;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {orderedBlocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level >= 4 ? "h4" : "h3";
          const headingClass =
            block.level <= 3
              ? "text-xl font-semibold tracking-tight text-foreground"
              : "text-base font-semibold text-foreground";
          return (
            <Heading key={index} className={headingClass}>
              {renderInline(block.text, highlightQuery)}
            </Heading>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={index}
              className="text-[15px] leading-7 text-muted-foreground [text-wrap:pretty]"
            >
              {renderInline(block.text, highlightQuery)}
            </p>
          );
        }

        if (block.type === "list" || block.type === "orderedList") {
          const List = block.type === "list" ? "ul" : "ol";
          return (
            <List
              key={index}
              className={`space-y-2 pl-6 text-[15px] leading-7 text-muted-foreground ${
                block.type === "list" ? "list-disc" : "list-decimal"
              } marker:font-mono marker:text-primary`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-1">
                  {renderInline(item, highlightQuery)}
                </li>
              ))}
            </List>
          );
        }

        if (block.type === "code") {
          return (
            <CodeBlock
              key={index}
              code={block.code}
              highlightQuery={highlightQuery}
              language={block.language}
              limitHeight={limitCodeBlockHeight}
            />
          );
        }

        const [header, ...rows] = block.rows;
        const hasFieldColumn = header[0]?.trim().toLowerCase() === "field";

        return (
          <div
            key={index}
            className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border/80"
          >
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-secondary/55">
                  {header.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      scope="col"
                      className={`border-b border-border/80 px-4 py-3 font-semibold text-foreground ${
                        hasFieldColumn && cellIndex === 0
                          ? "w-56 min-w-56 whitespace-nowrap"
                          : ""
                      }`}
                    >
                      {renderInline(cell, highlightQuery)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-border/70 last:border-b-0"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={`px-4 py-3 align-top leading-6 text-muted-foreground ${
                          hasFieldColumn && cellIndex === 0
                            ? "w-56 min-w-56 whitespace-nowrap"
                            : ""
                        }`}
                      >
                        {renderInline(cell, highlightQuery)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
