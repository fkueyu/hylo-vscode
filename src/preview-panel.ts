// ============================================================
// Hylo Preview Panel — Webview 管理器
// 负责创建/销毁 Webview、监听编辑器事件、双向通信
// ============================================================

import * as vscode from "vscode";
import { parseHTML } from "./ast-parser";
import { NodeMapManager } from "./node-map";
import type { HyloNode, ExtToWebviewMessage, WebviewToExtMessage } from "./types";

export class HyloPreviewPanel {
  public static instance: HyloPreviewPanel | undefined;
  private static readonly viewType = "hyloPreview";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly nodeMap = new NodeMapManager();
  private disposables: vscode.Disposable[] = [];

  /** 当前跟踪的编辑器 */
  private trackedEditor: vscode.TextEditor | undefined;
  /** 防抖定时器 */
  private parseTimer: ReturnType<typeof setTimeout> | undefined;
  /** 防止循环联动的标志 */
  private isSyncing = false;

  // ── 静态工厂 ──────────────────────────────────────────

  static createOrShow(extensionUri: vscode.Uri, editor: vscode.TextEditor) {
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

    HyloPreviewPanel.instance = new HyloPreviewPanel(panel, extensionUri, editor);
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
        if (this.isSyncing) return;
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

    // 初始化时仅设置编辑器引用和标题，不发送数据。
    // 首屏渲染完全依赖 Webview 侧发来的 ready 握手信号触发，
    // 避免在 Tailwind CDN 尚未加载完毕时发送重复的 update 导致脚本时序错乱。
    this.trackedEditor = editor;
    this.panel.title = `Hylo: ${editor.document.fileName.split("/").pop() ?? "Preview"}`;
  }

  // ── 核心方法 ──────────────────────────────────────────

  private trackEditor(editor: vscode.TextEditor) {
    console.log("[Hylo Ext] trackEditor called for:", editor.document.fileName);
    this.trackedEditor = editor;
    this.panel.title = `Hylo: ${editor.document.fileName.split("/").pop() ?? "Preview"}`;
    this.parseAndSend();
  }

  private debounceParse() {
    if (this.parseTimer) clearTimeout(this.parseTimer);
    this.parseTimer = setTimeout(() => this.parseAndSend(), 300);
  }

  private parseAndSend() {
    if (!this.trackedEditor) {
      console.log("[Hylo Ext] parseAndSend aborted: no trackedEditor");
      return;
    }
    const html = this.trackedEditor.document.getText();
    console.log("[Hylo Ext] parseAndSend starting, HTML length:", html.length);
    const result = parseHTML(html);

    // 更新 NodeMap
    this.nodeMap.update(result.nodeMap);

    let baseUri = undefined;
    if (this.trackedEditor.document.uri.scheme === "file") {
      const dirPath = require("path").dirname(this.trackedEditor.document.uri.fsPath);
      const dirUri = vscode.Uri.file(dirPath);
      baseUri = this.panel.webview.asWebviewUri(dirUri).toString() + "/";
    }

    // 发送 AST 到 Webview
    this.postMessage({
      type: "update",
      ast: result.root,
      stats: { nodeCount: result.nodeCount, parseTime: result.parseTime },
      baseUri,
    });
  }

  private handleWebviewMessage(msg: any) {
    console.log("[Hylo Ext] handleWebviewMessage received:", msg);
    switch (msg.type) {
      case "ready": {
        console.log("[Hylo Ext] Webview is ready, triggering first parse & send");
        this.parseAndSend();
        break;
      }
      case "requestUpdate": {
        console.log("[Hylo Ext] Webview requested an update (for async rendering sync)");
        this.parseAndSend();
        break;
      }
      case "click": {
        const loc = this.nodeMap.getLocation(msg.nodeId);
        if (!loc || !this.trackedEditor) return;

        this.isSyncing = true;

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
          backgroundColor: "rgba(99, 102, 241, 0.15)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          borderRadius: "3px",
        });
        this.trackedEditor.setDecorations(decorationType, [range]);

        // 2 秒后移除高亮
        setTimeout(() => {
          decorationType.dispose();
          this.isSyncing = false;
        }, 2000);

        // 确保编辑器获得焦点
        vscode.window.showTextDocument(this.trackedEditor.document, this.trackedEditor.viewColumn);
        break;
      }
    }
  }

  private postMessage(msg: ExtToWebviewMessage) {
    console.log("[Hylo Ext] postMessage sending type:", msg.type);
    this.panel.webview.postMessage(msg);
  }

  private onDispose() {
    HyloPreviewPanel.instance = undefined;
    if (this.parseTimer) clearTimeout(this.parseTimer);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  // ── Webview HTML ──────────────────────────────────────

  private getWebviewContent(): string {
    const mediaUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media")
    );

    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src * data: blob: vscode-webview-resource: vscode-resource:; style-src 'unsafe-inline' *; script-src 'unsafe-inline' 'unsafe-eval' https: http: vscode-resource: vscode-webview: vscode-webview-resource:; connect-src *; font-src * data:;">
  <link href="${mediaUri}/preview.css" rel="stylesheet">
  <script nonce="${nonce}">window.tailwind = window.tailwind || {};</script>
  <title>Hylo Preview</title>
</head>
<body>
  <div id="hylo-stats"></div>
  <div id="hylo-root"></div>
  <div id="hylo-empty">
    <p>在编辑器中打开 HTML 文件即可预览</p>
  </div>
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
