/**
 * Split streaming Markdown into top-level blocks so finished blocks can be
 * rendered once and memoized; only the last (growing) block re-parses on
 * each update. Linear scan, safe on partial text.
 *
 * A block boundary is a blank line outside a fenced code block. Lists and
 * tables stay intact (they have no blank lines inside). The last block is
 * "open" while streaming; a fenced code block is "closed" once its closing
 * fence has arrived (used to delay syntax highlighting).
 */
export interface MdBlock {
  text: string;
  /** Contains a fenced code block whose closing fence hasn't arrived yet. */
  openFence: boolean;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function splitMarkdownBlocks(md: string): MdBlock[] {
  const lines = md.split("\n");
  const blocks: MdBlock[] = [];
  let cur: string[] = [];
  let fence: string | null = null; // the opening fence chars while inside a code block

  const flush = () => {
    if (cur.length && cur.some((l) => l.trim() !== "")) blocks.push({ text: cur.join("\n"), openFence: false });
    cur = [];
  };

  for (const line of lines) {
    const m = FENCE.exec(line);
    if (fence) {
      cur.push(line);
      // Closing fence: same char, at least as long, nothing else on the line.
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length && line.trim() === m[1]) fence = null;
      continue;
    }
    if (m) {
      fence = m[1]!;
      cur.push(line);
      continue;
    }
    if (line.trim() === "") flush();
    else cur.push(line);
  }
  if (cur.length && cur.some((l) => l.trim() !== "")) blocks.push({ text: cur.join("\n"), openFence: fence !== null });
  return blocks;
}
