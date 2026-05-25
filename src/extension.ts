// ============================================================
// Hylo VS Code Extension — 入口
// ============================================================

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import HTMLtoDOCX from "html-to-docx";
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

  // 注册 "Hylo: Export to PDF" 命令
  const exportPDFDisposable = vscode.commands.registerCommand("hylo.exportToPDF", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("请先打开一个 HTML 文件");
      return;
    }
    const htmlContent = editor.document.getText();
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `hylo-export-${Date.now()}.html`);
    try {
      fs.writeFileSync(tempFilePath, htmlContent, "utf8");
      vscode.env.openExternal(vscode.Uri.file(tempFilePath));
      vscode.window.showInformationMessage("已在外部浏览器中打开 HTML 预览，请使用浏览器的“打印/另存为 PDF”功能完成导出。");
    } catch (e: any) {
      vscode.window.showErrorMessage(`导出 PDF 失败: ${e.message}`);
    }
  });
  context.subscriptions.push(exportPDFDisposable);

  // 注册 "Hylo: Export to Word" 命令
  const exportWordDisposable = vscode.commands.registerCommand("hylo.exportToWord", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("请先打开一个 HTML 文件");
      return;
    }
    const htmlContent = editor.document.getText();
    
    const saveUri = await vscode.window.showSaveDialog({
      filters: {
        "Word Document": ["docx"],
      },
      defaultUri: vscode.Uri.file(path.join(os.homedir(), "Untitled.docx")),
    });

    if (!saveUri) {
      return; // 用户取消
    }

    try {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${htmlContent}</body></html>`;
      const fileBuffer = await HTMLtoDOCX(fullHtml, undefined, {
        table: { row: { cantSplit: true } },
        footer: true,
        header: true,
        pageNumber: true,
      });

      fs.writeFileSync(saveUri.fsPath, fileBuffer);
      vscode.window.showInformationMessage("成功导出 Word 文件！");
    } catch (e: any) {
      vscode.window.showErrorMessage(`导出 Word 失败: ${e.message}`);
    }
  });
  context.subscriptions.push(exportWordDisposable);

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
