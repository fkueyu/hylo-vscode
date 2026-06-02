# Changelog

## [0.1.10] - 2026-06-02

### Fixed
- Removed Shadow DOM inside the webview to ensure Tailwind CSS CDN styles are applied correctly.
- Relaxed the Webview CSP rules to allow Tailwind CDN loading, external images, and Google Fonts.
- Fixed a `SyntaxError` caused by duplicate `const`/`let` variable declarations during editor updates by block-wrapping inline script execution with `try-catch`.
- Automatically clean up processed inline scripts on update to prevent DOM tree bloat.

### 修复
- 移除了 Webview 内部的 Shadow DOM 隔离，确保 Tailwind CSS CDN 样式能够完美作用于预览元素。
- 放宽 Webview 的 CSP 安全策略，允许加载 Tailwind CDN、外部图片资源及谷歌字体等。
- 使用块级作用域 `{ ... }` 及 `try-catch` 保护内联脚本的执行，解决了频繁输入触发重新编译时导致的 `SyntaxError` 变量重复声明报错（淡入动画不显示 Bug）。
- 每次更新时自动清理上次渲染残留的内联脚本节点，防止 Webview DOM 树膨胀。

## [0.1.9] - 2026-05-25

### Added
- Added PDF and Word (.docx) export actions for HTML source editor.
- Implemented standard VS Code NLS (localization) support: automatically switches between English and Chinese based on VS Code display language.
- Added commands `hylo.exportToPDF` and `hylo.exportToWord` inside the editor context menu and command palette.

### 新增
- HTML 源码编辑器新增 PDF 与 Word (.docx) 导出功能。
- 支持标准 VS Code NLS 国际化本地化，自动根据 VS Code 当前界面语言切换中英文菜单。
- 在编辑器右键上下文菜单及命令面板中添加了 `hylo.exportToPDF` 和 `hylo.exportToWord` 命令入口。
