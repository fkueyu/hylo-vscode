// ============================================================
// Hylo VS Code Extension — 入口
// ============================================================

import * as vscode from "vscode";
import { HyloPreviewPanel } from "./preview-panel";

export function activate(context: vscode.ExtensionContext) {
  // 注册 "Hylo: Open HTML Preview" 命令
  const disposable = vscode.commands.registerCommand("hylo.openPreview", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("请先打开一个 HTML 文件");
      return;
    }
    HyloPreviewPanel.createOrShow(context.extensionUri, editor);
  });

  context.subscriptions.push(disposable);

  // 如果当前打开的就是 HTML 文件，在状态栏显示提示
  if (
    vscode.window.activeTextEditor?.document.languageId === "html"
  ) {
    vscode.window.setStatusBarMessage("$(open-preview) Hylo: Cmd+Shift+P → Open HTML Preview", 5000);
  }
}

export function deactivate() {
  HyloPreviewPanel.dispose();
}
