"use client";
import { memo, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { splitMarkdownBlocks } from "@/lib/markdownBlocks";
import "highlight.js/styles/github-dark.css";

/** Rendered by the caller for links of the form "#cite-<n>-<status>" (NEXORA research answers). */
export type CitationRenderer = (n: number, status: string) => React.ReactNode;

const REMARK = [remarkGfm];
const REHYPE_HIGHLIGHT = [rehypeHighlight];
const REHYPE_NONE: [] = [];

/**
 * Markdown renderer.
 *
 * Performance (see the streaming-freeze investigation): every streamed delta
 * used to re-parse and re-highlight the whole message. Now:
 *  - the component is memoized, so finished messages never re-render while
 *    another message streams;
 *  - while streaming, the text is split into top-level blocks; finished blocks
 *    are memoized and only the growing last block re-parses;
 *  - syntax highlighting is skipped for a block whose code fence is still open.
 * When streaming ends the whole text is rendered once, exactly as before.
 */
export const Markdown = memo(function Markdown({
  text,
  streaming,
  renderCitation,
}: {
  text: string;
  streaming?: boolean;
  renderCitation?: CitationRenderer;
}) {
  const components = useMemo(() => makeComponents(renderCitation), [renderCitation]);
  const blocks = useMemo(() => (streaming ? splitMarkdownBlocks(text) : null), [streaming, text]);

  return (
    <div className={cn("markdown-body", streaming && "stream-caret")}>
      {blocks ? (
        blocks.map((b, i) => (
          <MarkdownBlock key={i} text={b.text} highlight={!b.openFence} components={components} />
        ))
      ) : (
        <MarkdownBlock text={text} highlight components={components} />
      )}
    </div>
  );
});

/** One parse of one chunk of Markdown; memoized on its text. */
const MarkdownBlock = memo(function MarkdownBlock({
  text,
  highlight,
  components,
}: {
  text: string;
  highlight: boolean;
  components: Components;
}) {
  return (
    <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={highlight ? REHYPE_HIGHLIGHT : REHYPE_NONE} components={components}>
      {text}
    </ReactMarkdown>
  );
});

function makeComponents(renderCitation?: CitationRenderer): Components {
  return {
    pre: ({ children }) => (
      <div className="relative group/code">
        <CopyButton getText={() => extractText(children)} />
        <pre>{children}</pre>
      </div>
    ),
    // Only research answers pass renderCitation; normal chat keeps default links.
    ...(renderCitation
      ? {
          a: ({ href, title, children }) => {
            const m = href?.match(/^#cite-(\d+)-(\w+)$/);
            if (m) return <>{renderCitation(Number(m[1]), m[2]!)}</>;
            return (
              <a href={href} title={title} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }
      : {}),
  };
}

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const p = (node as { props?: { children?: unknown } }).props;
    return extractText(p?.children);
  }
  return "";
}

function CopyButton({ getText }: { getText: () => string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        } catch {}
      }}
      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg glass grid place-items-center opacity-0 group-hover/code:opacity-100 transition-opacity"
      title="Copy code"
    >
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}
