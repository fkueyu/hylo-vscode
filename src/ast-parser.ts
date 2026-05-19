// ============================================================
// Hylo AST Parser (VS Code Edition)
// HTML String → HyloNode 树 + NodeMap
// 从 Hylo 桌面版直接移植，移除路径别名
// ============================================================

import { parse } from "parse5";
import { nanoid } from "nanoid";
import type { HyloNode, SourceLocation, ParseResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P5Node = any;

function extractLocation(loc: P5Node): SourceLocation | null {
  if (!loc) return null;
  return {
    startLine: loc.startLine ?? 1,
    startCol: loc.startCol ?? 1,
    endLine: loc.endLine ?? 1,
    endCol: loc.endCol ?? 1,
    startOffset: loc.startOffset ?? 0,
    endOffset: loc.endOffset ?? 0,
  };
}

function traverseNode(
  node: P5Node,
  nodeMap: Map<string, SourceLocation>,
  counter: { count: number }
): HyloNode {
  const nodeId = nanoid(8);
  counter.count++;

  const nodeName: string = node.nodeName ?? "";

  if (nodeName === "#document") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    const children: HyloNode[] = (node.childNodes ?? []).map((child: P5Node) =>
      traverseNode(child, nodeMap, counter)
    );
    return { nodeId, type: "document", children, sourceLocation };
  }

  if (nodeName === "#document-type" || nodeName === "#documentType") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    return { nodeId, type: "doctype", sourceLocation };
  }

  if (nodeName === "#text") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    return {
      nodeId,
      type: "text",
      textContent: node.value ?? "",
      sourceLocation,
    };
  }

  if (nodeName === "#comment") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    return {
      nodeId,
      type: "comment",
      textContent: node.data ?? "",
      sourceLocation,
    };
  }

  const sourceLocation = extractLocation(node.sourceCodeLocation);
  if (sourceLocation) nodeMap.set(nodeId, sourceLocation);

  const attrs: Record<string, string> = {};
  for (const attr of node.attrs ?? []) {
    attrs[attr.name] = attr.value;
  }

  const children: HyloNode[] = (node.childNodes ?? []).map((child: P5Node) =>
    traverseNode(child, nodeMap, counter)
  );

  return {
    nodeId,
    type: "element",
    tagName: (node.tagName ?? nodeName).toLowerCase(),
    attrs,
    children,
    sourceLocation,
  };
}

/**
 * 将 HTML 字符串解析为 HyloNode 树和 NodeMap
 */
export function parseHTML(html: string): ParseResult {
  const start = performance.now();
  const ast = parse(html, { sourceCodeLocationInfo: true });
  const nodeMap = new Map<string, SourceLocation>();
  const counter = { count: 0 };
  const root = traverseNode(ast, nodeMap, counter);
  const parseTime = performance.now() - start;

  return { root, nodeMap, parseTime, nodeCount: counter.count };
}
