// ============================================================
// Hylo Preview Panel — Webview 管理器
// 负责创建/销毁 Webview、监听编辑器事件、双向通信
// ============================================================

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import { shouldParseInWorker } from "@ainx/hylo-core";
import { parseHTML } from "./ast-parser";
import { NodeMapManager } from "./node-map";
import {
  createFrameDocumentCsp,
  createHostCsp,
  resolvePreviewMode,
  type PreviewMode,
} from "./preview-security";
import type {
  ExtToWebviewMessage,
  HyloNode,
  SourceLocation,
  WebviewToExtMessage,
} from "./types";

interface WorkerParseResult {
  version: number;
  root: HyloNode;
  nodeMap: Array<[string, SourceLocation]>;
  parseTime: number;
  nodeCount: number;
}

export class HyloPreviewPanel {
  public static instance: HyloPreviewPanel | undefined;
  private static readonly viewType = "hyloPreview";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly nodeMap = new NodeMapManager();
  private parserWorker: Worker | undefined;
  private readonly sessionToken = getNonce();
  private disposables: vscode.Disposable[] = [];
  private parseVersion = 0;
  private parserWorkerAvailable = true;
  /** 本地资源（CSS/JS/图片）内联缓存：path -> { mtimeMs, size, content } */
  private readonly assetCache = new Map<string, { mtimeMs: number; size: number; text?: string; dataUrl?: string }>();

  /** 当前跟踪的编辑器 */
  private trackedEditor: vscode.TextEditor | undefined;
  /** 防抖定时器 */
  private parseTimer: ReturnType<typeof setTimeout> | undefined;
  /** 仅忽略由预览点击触发的下一次选择事件，避免吞掉后续真实光标移动。 */
  private suppressNextSelection = false;
  private previewMode: PreviewMode = "safe";

  // ── 静态工厂 ──────────────────────────────────────────

  static createOrShow(
    extensionUri: vscode.Uri,
    editor: vscode.TextEditor,
  ) {
    // 如果已有面板，直接 reveal
    if (HyloPreviewPanel.instance) {
      HyloPreviewPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      HyloPreviewPanel.instance.trackEditor(editor);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      HyloPreviewPanel.viewType,
      "Hylo Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(f => f.uri) : []),
          ...(editor.document.uri.scheme === 'file' ? [vscode.Uri.file(require("path").dirname(editor.document.uri.fsPath))] : [])
        ],
        retainContextWhenHidden: true,
      }
    );

    HyloPreviewPanel.instance = new HyloPreviewPanel(
      panel,
      extensionUri,
      editor,
    );
  }

  static dispose() {
    HyloPreviewPanel.instance?.panel.dispose();
  }

  // ── 构造 ──────────────────────────────────────────────

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    editor: vscode.TextEditor
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.previewMode = this.resolveConfiguredMode();
    try {
      this.parserWorker = new Worker(
        vscode.Uri.joinPath(extensionUri, "dist", "parser-worker.js").fsPath,
      );
      this.parserWorker.on("message", (result: WorkerParseResult) => this.sendParseResult(result));
      this.parserWorker.on("error", () => this.handleWorkerFailure());
      this.parserWorker.on("messageerror", () => this.handleWorkerFailure());
      this.parserWorker.on("exit", (code) => {
        if (code !== 0) this.handleWorkerFailure();
      });
    } catch {
      this.parserWorkerAvailable = false;
    }

    // 监听 Webview 发来的消息（预览 → 源码）
    // 注意：必须在设置 webview.html 之前注册监听器，防止 Webview 加载过快导致初始的 ready 信号丢失！
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtMessage) => this.handleWebviewMessage(msg),
      null,
      this.disposables
    );

    // 设置 Webview HTML
    this.panel.webview.html = this.getWebviewContent();

    // 面板关闭时清理
    this.panel.onDidDispose(() => this.onDispose(), null, this.disposables);

    // 监听编辑器切换
    vscode.window.onDidChangeActiveTextEditor(
      (e) => {
        if (e && e.document.languageId === "html") {
          this.trackEditor(e);
        }
      },
      null,
      this.disposables
    );

    // 监听文档内容变化
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (this.trackedEditor && e.document === this.trackedEditor.document) {
          this.debounceParse();
        }
      },
      null,
      this.disposables
    );

    // 监听光标位置变化（源码 → 预览）
    vscode.window.onDidChangeTextEditorSelection(
      (e) => {
        if (this.suppressNextSelection) {
          this.suppressNextSelection = false;
          return;
        }
        if (e.textEditor === this.trackedEditor && e.selections.length > 0) {
          const pos = e.selections[0].active;
          // VS Code Position 是 0-based，NodeMap 是 1-based
          const nodeId = this.nodeMap.findNodeAtPosition(pos.line + 1, pos.character + 1);
          if (nodeId) {
            this.postMessage({ type: "highlight", nodeId });
          }
        }
      },
      null,
      this.disposables
    );

    vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (!event.affectsConfiguration("hylo.previewMode")) return;
        this.previewMode = this.resolveConfiguredMode();
        this.postMessage({ type: "previewMode", mode: this.previewMode, workspaceTrusted: vscode.workspace.isTrusted });
        this.parseAndSend();
      },
      null,
      this.disposables,
    );

    vscode.workspace.onDidGrantWorkspaceTrust(
      () => {
        this.previewMode = this.resolveConfiguredMode();
        this.postMessage({ type: "previewMode", mode: this.previewMode, workspaceTrusted: vscode.workspace.isTrusted });
        this.parseAndSend();
      },
      null,
      this.disposables,
    );

    // 初始化时仅设置编辑器引用和标题，不发送数据。
    // 首屏渲染完全依赖 Webview 侧发来的 ready 握手信号触发，
    // 避免在 Tailwind CDN 尚未加载完毕时发送重复的 update 导致脚本时序错乱。
    this.trackedEditor = editor;
    this.panel.title = `Hylo: ${editor.document.fileName.split("/").pop() ?? "Preview"}`;
  }

  // ── 核心方法 ──────────────────────────────────────────

  private trackEditor(editor: vscode.TextEditor) {
    this.trackedEditor = editor;
    this.panel.title = `Hylo: ${editor.document.fileName.split("/").pop() ?? "Preview"}`;
    this.parseAndSend();
  }

  private debounceParse() {
    if (this.parseTimer) clearTimeout(this.parseTimer);
    this.parseTimer = setTimeout(() => this.parseAndSend(), 300);
  }

  private parseAndSend() {
    if (!this.trackedEditor) return;
    const html = this.trackedEditor.document.getText();
    const version = ++this.parseVersion;
    this.nodeMap.clear();
    this.postMessage({ type: "parsing" });
    if (shouldParseInWorker(html.length) && this.parserWorkerAvailable && this.parserWorker) {
      try {
        this.parserWorker.postMessage({ version, html });
      } catch {
        this.handleWorkerFailure();
      }
      return;
    }
    const result = parseHTML(html);

    this.sendParseResult({
      version,
      root: result.root,
      nodeMap: [...result.nodeMap],
      parseTime: result.parseTime,
      nodeCount: result.nodeCount,
    });
  }

  // ── 本地资源内联 ─────────────────────────────────────
  // Webview 内的沙箱 iframe 无法加载 vscode-webview-resource 子资源（本地 CSS/JS/图片），
  // 因此在把 AST 发给预览帧之前，把相对路径的本地资源直接内联进文档：
  // CSS → <style>，JS → 内联 <script>，图片 → data: URL。

  private resolveLocalAsset(reference: string, baseDir: string): string | null {
    const trimmed = (reference || "").trim();
    if (!trimmed || trimmed.startsWith("#")) return null;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) return null;
    const withoutQuery = trimmed.split(/[?#]/)[0];
    if (!withoutQuery) return null;
    let decoded = withoutQuery;
    try { decoded = decodeURIComponent(withoutQuery); } catch { /* keep raw */ }
    const absolute = path.isAbsolute(decoded) ? decoded : path.resolve(baseDir, decoded);
    try {
      return fs.statSync(absolute).isFile() ? absolute : null;
    } catch {
      return null;
    }
  }

  private readAssetText(fsPath: string, maxBytes: number): string | null {
    try {
      const stat = fs.statSync(fsPath);
      if (!stat.isFile() || stat.size > maxBytes) return null;
      const cached = this.assetCache.get(fsPath);
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return cached.text ?? null;
      }
      const text = fs.readFileSync(fsPath, "utf8");
      this.assetCache.set(fsPath, { mtimeMs: stat.mtimeMs, size: stat.size, text });
      return text;
    } catch {
      return null;
    }
  }

  private readAssetDataUrl(fsPath: string, maxBytes: number): string | null {
    try {
      const stat = fs.statSync(fsPath);
      if (!stat.isFile() || stat.size > maxBytes) return null;
      const cached = this.assetCache.get(fsPath);
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return cached.dataUrl ?? null;
      }
      const mimeByExtension: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".avif": "image/avif",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
      };
      const mime = mimeByExtension[path.extname(fsPath).toLowerCase()] ?? "application/octet-stream";
      const dataUrl = `data:${mime};base64,${fs.readFileSync(fsPath).toString("base64")}`;
      this.assetCache.set(fsPath, { mtimeMs: stat.mtimeMs, size: stat.size, dataUrl });
      return dataUrl;
    } catch {
      return null;
    }
  }

  /** 把相对路径的本地 CSS/JS/图片内联进 AST（原地修改，返回同一棵树）。 */
  private inlineLocalAssets(root: HyloNode, documentUri: vscode.Uri): HyloNode {
    if (documentUri.scheme !== "file") return root;
    const baseDir = path.dirname(documentUri.fsPath);
    const visit = (node: HyloNode) => {
      if (node.type === "element" && node.tagName) {
        const tag = node.tagName.toLowerCase();
        const attrs = node.attrs ?? {};
        if (tag === "link" && /(?:^|\s)stylesheet(?:\s|$)/i.test(attrs.rel ?? "")) {
          const assetPath = this.resolveLocalAsset(attrs.href ?? "", baseDir);
          const text = assetPath ? this.readAssetText(assetPath, 1024 * 1024) : null;
          if (text !== null) {
            node.tagName = "style";
            node.attrs = {};
            node.children = [
              { nodeId: `${node.nodeId}_style`, type: "text", textContent: text, sourceLocation: node.sourceLocation },
            ];
          }
        } else if (tag === "script" && attrs.src) {
          const assetPath = this.resolveLocalAsset(attrs.src, baseDir);
          const text = assetPath ? this.readAssetText(assetPath, 2 * 1024 * 1024) : null;
          if (text !== null) {
            node.attrs = {};
            node.children = [
              { nodeId: `${node.nodeId}_script`, type: "text", textContent: text, sourceLocation: node.sourceLocation },
            ];
          }
        } else if (["img", "source", "video", "audio"].includes(tag) && attrs.src) {
          const assetPath = this.resolveLocalAsset(attrs.src, baseDir);
          const dataUrl = assetPath ? this.readAssetDataUrl(assetPath, 6 * 1024 * 1024) : null;
          if (dataUrl) node.attrs = { ...attrs, src: dataUrl };
        } else if (tag === "video" && attrs.poster) {
          const assetPath = this.resolveLocalAsset(attrs.poster, baseDir);
          const dataUrl = assetPath ? this.readAssetDataUrl(assetPath, 6 * 1024 * 1024) : null;
          if (dataUrl) node.attrs = { ...attrs, poster: dataUrl };
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return root;
  }

  private sendParseResult(result: WorkerParseResult) {
    if (result.version !== this.parseVersion || !this.trackedEditor) return;

    // 更新 NodeMap
    this.nodeMap.update(new Map(result.nodeMap));

    let baseUri = undefined;
    if (this.trackedEditor.document.uri.scheme === "file") {
      const dirPath = require("path").dirname(this.trackedEditor.document.uri.fsPath);
      const dirUri = vscode.Uri.file(dirPath);
      baseUri = this.panel.webview.asWebviewUri(dirUri).toString() + "/";
    }

    // 本地相对资源（CSS/JS/图片）内联后再发送，沙箱 iframe 无法直接请求 webview 资源
    const previewAst = this.inlineLocalAssets(result.root, this.trackedEditor.document.uri);

    // 发送 AST 到 Webview
    this.postMessage({
      type: "update",
      ast: previewAst,
      stats: { nodeCount: result.nodeCount, parseTime: result.parseTime },
      baseUri,
      mode: this.previewMode,
      workspaceTrusted: vscode.workspace.isTrusted,
    });
  }

  private handleWebviewMessage(msg: WebviewToExtMessage) {
    if (!msg || msg.sessionToken !== this.sessionToken) return;
    switch (msg.type) {
      case "ready": {
        this.parseAndSend();
        break;
      }
      case "setPreviewMode": {
        void this.setPreviewMode(msg.mode);
        break;
      }
      case "click": {
        const loc = this.nodeMap.getLocation(msg.nodeId);
        if (!loc || !this.trackedEditor) return;

        this.suppressNextSelection = true;

        // 跳转到对应源码位置（VS Code Range 是 0-based）
        const range = new vscode.Range(
          loc.startLine - 1,
          loc.startCol - 1,
          loc.endLine - 1,
          loc.endCol - 1
        );

        this.trackedEditor.selection = new vscode.Selection(range.start, range.start);
        this.trackedEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);

        // 添加高亮装饰
        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: "rgba(117, 111, 242, 0.15)",
          border: "1px solid rgba(117, 111, 242, 0.48)",
          borderRadius: "3px",
        });
        this.trackedEditor.setDecorations(decorationType, [range]);

        // 2 秒后移除高亮
        setTimeout(() => {
          decorationType.dispose();
        }, 1200);

        // 确保编辑器获得焦点
        vscode.window.showTextDocument(this.trackedEditor.document, this.trackedEditor.viewColumn);
        break;
      }
    }
  }

  private postMessage(msg: ExtToWebviewMessage) {
    void this.panel.webview.postMessage({ ...msg, sessionToken: this.sessionToken });
  }

  private resolveConfiguredMode(): PreviewMode {
    const configured = vscode.workspace
      .getConfiguration("hylo", this.trackedEditor?.document.uri)
      .get<PreviewMode>("previewMode", "safe");
    return resolvePreviewMode(configured, vscode.workspace.isTrusted);
  }

  private async setPreviewMode(requested: PreviewMode): Promise<void> {
    if (requested === "interactive" && !vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(
        vscode.env.language.toLowerCase().startsWith("zh")
          ? "当前工作区未受信任，Hylo 已保持安全预览。"
          : "This workspace is not trusted. Hylo remains in Safe Preview.",
      );
      this.previewMode = "safe";
      this.postMessage({
        type: "previewMode",
        mode: "safe",
        workspaceTrusted: false,
      });
      return;
    }

    await vscode.workspace
      .getConfiguration("hylo", this.trackedEditor?.document.uri)
      .update("previewMode", requested, vscode.ConfigurationTarget.Workspace);
    this.previewMode = this.resolveConfiguredMode();
    this.postMessage({ type: "previewMode", mode: this.previewMode, workspaceTrusted: vscode.workspace.isTrusted });
    this.parseAndSend();
  }

  private handleWorkerFailure(): void {
    if (!this.parserWorkerAvailable) return;
    this.parserWorkerAvailable = false;
    void this.parserWorker?.terminate();
    this.parserWorker = undefined;
    this.parseAndSend();
  }

  private onDispose() {
    HyloPreviewPanel.instance = undefined;
    if (this.parseTimer) clearTimeout(this.parseTimer);
    void this.parserWorker?.terminate();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  // ── Webview HTML ──────────────────────────────────────

  /** 预览帧（srcdoc）：运行时内联，不依赖 vscode-webview-resource 资源请求。 */
  private createFrameDocument(mode: PreviewMode, nonce: string): string {
    const runtimeSource = this.readFrameRuntimeSource();
    const cspSource = this.panel.webview.cspSource;
    const csp = createFrameDocumentCsp(cspSource, nonce, mode);
    return `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">
  <style nonce="${nonce}">
    html,body{min-height:100%;margin:0}
    body{color:#000;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    [data-hylo-id]:hover{cursor:pointer;outline:1px dashed rgba(34,199,184,.58);outline-offset:1px}
    .hylo-preview-highlight{background:rgba(117,111,242,.12)!important;outline:2px solid rgba(117,111,242,.66)!important;outline-offset:1px;border-radius:4px;box-shadow:0 0 0 4px rgba(34,199,184,.08)}
    @media print{[data-hylo-id]:hover,.hylo-preview-highlight{outline:none!important;box-shadow:none!important;background:transparent!important}}
  </style>
</head><body>
  <script nonce="${nonce}">${runtimeSource}</script>
</body></html>`;
  }

  private frameRuntimeSource: string | undefined;

  private readFrameRuntimeSource(): string {
    if (this.frameRuntimeSource !== undefined) return this.frameRuntimeSource;
    const runtimePath = vscode.Uri.joinPath(this.extensionUri, "media", "preview-frame.js").fsPath;
    this.frameRuntimeSource = fs
      .readFileSync(runtimePath, "utf8")
      .replace(/<\/script/gi, "<\\/script");
    return this.frameRuntimeSource;
  }

  private getWebviewContent(): string {
    const mediaUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media")
    );
    const nonce = getNonce();
    const safeFrameDocument = this.createFrameDocument("safe", nonce);
    const interactiveFrameDocument = this.createFrameDocument("interactive", nonce);
    const isZh = vscode.env.language.toLowerCase().startsWith("zh");
    const labels = isZh ? {
      structure: "文档结构",
      showStructure: "显示文档结构",
      hideStructure: "隐藏文档结构",
      selectHint: "选择预览元素以定位源码",
      empty: "在编辑器中打开 HTML 文件即可预览",
      outlineEmpty: "添加 HTML 元素后将在这里显示结构",
      safeMode: "安全预览",
      interactiveMode: "交互预览",
      safeHint: "脚本和远程资源已阻止",
      toggleMode: "切换预览安全模式",
      frameErrorSafe: "预览帧初始化失败：当前 IDE 的 Webview 可能限制了嵌套预览帧。可尝试升级 IDE，或改用 VS Code 打开。",
      frameErrorInteractive: "交互预览无法在当前 IDE 中初始化，请切回安全预览或改用 VS Code。",
    } : {
      structure: "Document structure",
      showStructure: "Show document structure",
      hideStructure: "Hide document structure",
      selectHint: "Select a preview element to locate its source",
      empty: "Open an HTML file in the editor to start previewing",
      outlineEmpty: "HTML elements will appear here as you add them",
      safeMode: "Safe Preview",
      interactiveMode: "Interactive Preview",
      safeHint: "Scripts and remote resources are blocked",
      toggleMode: "Toggle preview security mode",
      frameErrorSafe: "Preview frame failed to initialize: this IDE may restrict nested preview frames. Try updating the IDE or use VS Code.",
      frameErrorInteractive: "Interactive preview cannot initialize in this IDE; switch back to Safe Preview or use VS Code.",
    };

    const hostCsp = createHostCsp(this.panel.webview.cspSource, nonce);

    return /* html */ `<!DOCTYPE html>
<html lang="${isZh ? "zh-CN" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="${hostCsp}">
  <link href="${mediaUri}/preview.css" rel="stylesheet">
  <title>Hylo Preview</title>
</head>
<body class="hylo-host-shell">
  <header id="hylo-toolbar">
    <div class="hylo-toolbar__brand" aria-label="Hylo">
      <span class="hylo-toolbar__mark" aria-hidden="true"></span>
      <span>Hylo</span>
    </div>
    <div id="hylo-breadcrumb" data-empty-label="${labels.selectHint}">
      <span class="hylo-breadcrumb__hint">${labels.selectHint}</span>
    </div>
    <div class="hylo-toolbar__meta">
      <span id="hylo-mode-hint" data-safe-hint="${labels.safeHint}"></span>
      <button
        id="hylo-mode-toggle"
        type="button"
        title="${labels.toggleMode}"
        aria-label="${labels.toggleMode}"
        data-safe-label="${labels.safeMode}"
        data-interactive-label="${labels.interactiveMode}"
      >${labels.safeMode}</button>
      <div id="hylo-stats" aria-live="polite" data-node-label="${isZh ? "节点" : "nodes"}" data-parsing-label="${isZh ? "解析中…" : "Parsing…"}"></div>
      <button
        id="hylo-outline-toggle"
        type="button"
        title="${labels.showStructure}"
        aria-label="${labels.showStructure}"
        aria-expanded="false"
        data-show-label="${labels.showStructure}"
        data-hide-label="${labels.hideStructure}"
      >
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3.25 4.25h3.5v3.5h-3.5zM11.25 3.25h3.5v3.5h-3.5zM11.25 11.25h3.5v3.5h-3.5z" />
          <path d="M6.75 6h2A2.5 2.5 0 0 1 11.25 8.5v2.75M8.75 12.75h2.5" />
        </svg>
      </button>
    </div>
  </header>
  <div id="hylo-workspace">
    <aside id="hylo-outline" aria-label="${labels.structure}" data-empty-label="${labels.outlineEmpty}">
      <div class="hylo-outline__header">
        <span>${labels.structure}</span>
        <span id="hylo-outline-count">0</span>
      </div>
      <div id="hylo-outline-tree"></div>
    </aside>
    <main id="hylo-preview-surface">
      <iframe
        id="hylo-preview-frame"
        sandbox="allow-scripts"
        title="Hylo document preview"
        data-safe-srcdoc="${escapeHtmlAttribute(safeFrameDocument)}"
        data-interactive-srcdoc="${escapeHtmlAttribute(interactiveFrameDocument)}"
        data-error-safe="${escapeHtmlAttribute(labels.frameErrorSafe)}"
        data-error-interactive="${escapeHtmlAttribute(labels.frameErrorInteractive)}"
        data-session="${this.sessionToken}"
      ></iframe>
      <div id="hylo-empty">
        <p>${labels.empty}</p>
      </div>
    </main>
  </div>
  <script nonce="${nonce}" src="${mediaUri}/document-structure.js"></script>
  <script nonce="${nonce}" src="${mediaUri}/preview.js"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
