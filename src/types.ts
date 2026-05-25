// ============================================================
// Hylo Core Types (VS Code Edition)
// ============================================================

/**
 * 源代码位置信息
 * 行列号均为 1-based
 */
export interface SourceLocation {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Hylo 内部 AST 节点
 */
export interface HyloNode {
  nodeId: string;
  type: "element" | "text" | "comment" | "document" | "doctype";
  tagName?: string;
  attrs?: Record<string, string>;
  children?: HyloNode[];
  textContent?: string;
  sourceLocation: SourceLocation | null;
}

/**
 * AST 解析结果
 */
export interface ParseResult {
  root: HyloNode;
  nodeMap: Map<string, SourceLocation>;
  parseTime: number;
  nodeCount: number;
}

/**
 * Extension → Webview 消息类型
 */
export type ExtToWebviewMessage =
  | { type: "update"; ast: HyloNode; stats: { nodeCount: number; parseTime: number } }
  | { type: "highlight"; nodeId: string | null };

/**
 * Webview → Extension 消息类型
 */
export type WebviewToExtMessage =
  | { type: "click"; nodeId: string };

declare module "html-to-docx";

