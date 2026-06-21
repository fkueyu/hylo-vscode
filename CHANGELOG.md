# Changelog

## [0.1.15] - 2026-06-21

### Fixed
- Optimized Webview preview rendering to prevent layout re-evaluation and flickering on every keystroke by updating the `<base>` tag only when the active file path actually changes.

### 修复
- 优化了 Webview 预览的渲染性能，只有在打开文件的物理路径变化时才更新 `<base>` 标签的 `href` 属性，避免了每次敲击键盘均触发布局重算和闪烁的问题。

## [0.1.13] - 2026-06-21

### Fixed
- Fixed an issue where local relative image paths failed to load in the preview panel. Resolved by dynamically computing VS Code's Webview base URI of the file folder and relaxing Content Security Policy (CSP) rules for `vscode-webview-resource:` and `vscode-resource:` protocols.

### 修复
- 修复了预览面板中本地相对路径图片加载失败的问题。通过动态计算当前打开文件所在文件夹的 Webview URI 路径作为基础 URL，并放宽了 CSP（内容安全策略）以允许加载 `vscode-webview-resource:` 及 `vscode-resource:` 协议的图片。

## [0.1.12] - 2026-06-03

### Fixed
- Fixed an issue where Tailwind CSS would not render correctly on the first preview load if the user's inline `tailwind.config` was placed after the Tailwind CDN script. Introduced a "script hoisting" mechanism to guarantee the configuration runs first.
- Fixed a rendering issue where IntersectionObservers (like for scroll-based fade-in animations) would miscalculate on the initial load due to Tailwind generating CSS asynchronously. Added an automatic delayed secondary render pass to ensure styled layouts are calculated correctly.

### 修复
- 彻底修复了初次预览时，若用户在 HTML 中将 `tailwind.config` 定义在 Tailwind CDN 脚本之后，导致 Tailwind 主题和自定义颜色丢失的问题。引擎现在会自动“智能提权”，确保配置总是在 CDN 初始化前加载。
- 彻底修复了因 Tailwind 异步编译 CSS，导致 DOM 布局错乱，进而引发首屏滚动淡入动画 (`IntersectionObserver`) 失效或必须“点一下”才能恢复的 Bug。现在系统会在脚本初始化后自动触发一次完美的带样式重绘，确保所有动画首屏秒出。


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
