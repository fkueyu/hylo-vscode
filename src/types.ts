// ============================================================
// Hylo Core Types (VS Code Edition)
// ============================================================

import type { HyloNode } from "@ainx/hylo-core";

export type {
  HyloNode,
  ParseResult,
  SourceLocation,
} from "@ainx/hylo-core";

/**
 * Extension → Webview 消息类型
 */
export type ExtToWebviewMessage =
  | {
      type: "update";
      ast: HyloNode;
      stats: { nodeCount: number; parseTime: number };
      baseUri?: string;
      mode: "safe" | "interactive";
      workspaceTrusted: boolean;
      sessionToken?: string;
    }
  | { type: "highlight"; nodeId: string | null; sessionToken?: string }
  | { type: "previewMode"; mode: "safe" | "interactive"; workspaceTrusted: boolean; sessionToken?: string }
  | { type: "parsing"; sessionToken?: string };

/**
 * Webview → Extension 消息类型
 */
export type WebviewToExtMessage =
  | { type: "click"; nodeId: string; sessionToken: string }
  | { type: "ready"; sessionToken: string }
  | { type: "setPreviewMode"; mode: "safe" | "interactive"; sessionToken: string };
