// ============================================================
// Hylo VS Code Extension — 入口
// ============================================================

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import HTMLtoDOCX from "html-to-docx";
import { normalizeExportDocument } from "@ainx/hylo-core";
import { HyloPreviewPanel } from "./preview-panel";

const temporaryExportFiles = new Set<string>();

function removeTemporaryExportFile(filePath: string): void {
  temporaryExportFiles.delete(filePath);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Best-effort cleanup: the browser may still hold the file on Windows.
  }
}

function cleanupTemporaryExportFiles(): void {
  for (const filePath of [...temporaryExportFiles]) removeTemporaryExportFile(filePath);
  temporaryExportFiles.clear();
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push({ dispose: cleanupTemporaryExportFiles });
  // 注册 "Hylo: Open HTML Preview" 命令
  const disposable = vscode.commands.registerCommand("hylo.openPreview", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("请先打开一个 HTML 文件");
      return;
    }
    HyloPreviewPanel.createOrShow(context.extensionUri, context.globalStorageUri, editor);
  });

  context.subscriptions.push(disposable);

  // 注册 "Hylo: Export to PDF" 命令
  const exportPDFDisposable = vscode.commands.registerCommand("hylo.exportToPDF", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("请先打开一个 HTML 文件");
      return;
    }
    const htmlContent = editor.document.getText();
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `hylo-export-${Date.now()}.html`);
    try {
      const baseHref = editor.document.uri.scheme === "file"
        ? `${vscode.Uri.file(path.dirname(editor.document.uri.fsPath)).toString(true)}/`
        : undefined;
      const exportHtml = normalizeExportDocument(htmlContent, { baseHref });
      fs.writeFileSync(tempFilePath, exportHtml, "utf8");
      temporaryExportFiles.add(tempFilePath);
      const opened = await vscode.env.openExternal(vscode.Uri.file(tempFilePath));
      if (!opened) throw new Error("无法打开系统浏览器");
      vscode.window.showInformationMessage("已在外部浏览器中打开 HTML 预览，请使用浏览器的“打印/另存为 PDF”功能完成导出。");
    } catch (e: any) {
      removeTemporaryExportFile(tempFilePath);
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
      const normalizedHtml = normalizeExportDocument(htmlContent);
      const fileBuffer = await HTMLtoDOCX(normalizedHtml, undefined, {
        table: { row: { cantSplit: true } },
        footer: true,
        header: true,
        pageNumber: true,
      });

      const temporaryPath = path.join(
        path.dirname(saveUri.fsPath),
        `.${path.basename(saveUri.fsPath)}.hylo-${process.pid}-${Date.now()}.tmp`,
      );
      try {
        fs.writeFileSync(temporaryPath, fileBuffer, { flag: "wx" });
        fs.renameSync(temporaryPath, saveUri.fsPath);
      } catch (error) {
        try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch { /* cleanup only */ }
        throw error;
      }
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
  cleanupTemporaryExportFiles();
}
