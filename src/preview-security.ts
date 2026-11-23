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
  // 预览帧现在通过 srcdoc 内联（沙箱 iframe 无法请求 vscode-webview-resource 子资源）。
  // 宿主 CSP 需要为「交互预览」放行远程资源；安全模式由帧内 CSP meta 再收窄
  // （CSP 策略取交集：父策略放行但不代表子策略放行）。
  return [
    "default-src 'none'",
    `img-src ${cspSource} data: blob: https:`,
    `style-src ${cspSource} 'unsafe-inline' https:`,
    `font-src ${cspSource} data: https:`,
    `script-src 'nonce-${nonce}' ${cspSource} blob: https:`,
    "connect-src https:",
    `frame-src ${cspSource} https: data:`,
    "object-src 'none'",
    `base-uri ${cspSource}`,
    "form-action 'none'",
  ].join("; ");
}

/** 预览帧（srcdoc）自身的 CSP：在宿主策略之上按模式收窄/放行。 */
export function createFrameDocumentCsp(
  cspSource: string,
  nonce: string,
  mode: PreviewMode,
): string {
  const interactive = mode === "interactive";
  const remote = interactive ? " https:" : "";
  return [
    "default-src 'none'",
    `img-src ${cspSource} data: blob:${remote}`,
    `style-src ${cspSource} 'unsafe-inline'${remote}`,
    `font-src ${cspSource} data:${remote}`,
    `script-src 'nonce-${nonce}' ${cspSource}${interactive ? " blob: https:" : ""}`,
    `connect-src ${interactive ? "https:" : "'none'"}`,
    interactive ? "frame-src https:" : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
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
