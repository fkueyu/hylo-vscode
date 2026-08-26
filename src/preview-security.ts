export type PreviewMode = "safe" | "interactive";

export type PreviewFrameMessage =
  | { type: "preview-ready" }
  | { type: "node-selected"; nodeId: string }
  | { type: "render-stats"; nodeCount: number; renderTime: number };

export function resolvePreviewMode(
  requested: PreviewMode,
  workspaceTrusted: boolean,
): PreviewMode {
  return workspaceTrusted ? requested : "safe";
}

export function createHostCsp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src ${cspSource}`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
    "connect-src 'none'",
    `frame-src ${cspSource}`,
  ].join("; ");
}

export function isPreviewFrameMessage(value: unknown): value is PreviewFrameMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "preview-ready":
      return true;
    case "node-selected":
      return typeof message.nodeId === "string" && message.nodeId.length > 0;
    case "render-stats":
      return typeof message.nodeCount === "number"
        && Number.isFinite(message.nodeCount)
        && message.nodeCount >= 0
        && typeof message.renderTime === "number"
        && Number.isFinite(message.renderTime)
        && message.renderTime >= 0;
    default:
      return false;
  }
}
