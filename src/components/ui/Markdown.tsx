"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import "highlight.js/styles/github-dark.css";

export function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className={cn("markdown-body", streaming && "stream-caret")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => (
            <div className="relative group/code">
              <CopyButton getText={() => extractText(children)} />
              <pre>{children}</pre>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
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
