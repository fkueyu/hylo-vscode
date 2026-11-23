# Changelog

## [0.1.20] - 2026-11-23

- 修复预览空白 / 本地资源不加载的两个根因：
  1. **扩展 → Webview 消息被丢弃**：新版 VS Code 与 VS Code 分支里，宿主消息的 `event.source` 不再是 `window`/`null`（而是父窗口 proxy），旧的消息分流逻辑把它当成帧消息丢弃，导致 `update`/`parsing` 永远到不了预览页、面板空白。现在按 `channel`（帧消息）+ `sessionToken`（宿主消息）分流，不再依赖 `event.source`。
  2. **沙箱 iframe 无法加载本地子资源**：预览帧无法请求 `vscode-webview-resource` 的 CSS/JS/图片，因此改为 **srcdoc-only** 预览帧（运行时内联），并在扩展侧把相对路径的本地 CSS（→ `<style>`）、JS（→ 内联 `<script>`）、图片（→ `data:` URL）内联进 AST。
- CSP 同步调整：宿主为 srcdoc 帧放行交互预览所需资源，安全模式由帧内 CSP meta 再收窄（策略取交集）。
- 帧初始化超时会显示可操作错误提示，不再静默空白。
- 说明：安全预览按设计阻止脚本，本地 JS 需切到「交互预览」并在受信任工作区生效。

## [0.1.19] - 2026-11-23

- 修复本地相对资源不生效：沙箱预览 iframe 无法请求 `vscode-webview-resource` 子资源，导致相对路径的本地 CSS 不加载、本地 JS 不执行、本地图片不显示（内联 `<style>` 和 CDN 资源正常）。现在扩展会在发送预览 AST 前把相对路径的本地资源内联进文档——CSS → `<style>`、JS → 内联 `<script>`、图片 → `data:` URL（带大小上限与 mtime 缓存）。
- 说明：安全预览按设计仍会阻止脚本执行；本地 JS 需切换到「交互预览」并在受信任工作区中生效。

## [0.1.18] - 2026-11-23

- 兼容性修复：部分 VS Code 分支（如 Antigravity IDE）会限制 Webview 内嵌 `vscode-webview-resource` iframe，导致预览帧始终无法加载、面板空白。安全预览新增内联运行时 + `srcdoc` 兜底路径：资源帧 3 秒内未就绪时自动切换到不依赖资源请求的预览帧。
- 预览初始化失败时不再静默空白，而是在预览区显示可操作的错误提示（区分安全/交互模式），便于定位 IDE 限制。
- 宿主 CSP 收紧调整：样式允许 nonce，兼容内联 srcdoc 预览帧。

## [0.1.17] - 2026-11-23

- 同步桌面端共享核心：节点 ID 改为「显式 id 锚点 + 同标签序号」的稳定方案（插入不同标签的兄弟不再改变节点身份，重复 id 自动去重），修复结构变化后预览高亮/结构树定位漂移的问题。
- 文本节点 ID 不再随文本内容变化；为身份稳定性补充回归测试。

## [0.1.16] - 2026-08-26

- 默认启用安全预览，阻止文档脚本、远程资源和主动嵌入内容。
- 交互预览在独立沙箱 iframe 中运行，并要求 VS Code 工作区处于受信任状态。
- 收紧可信 Webview 的 CSP，增加消息来源校验和会话令牌，避免用户内容影响工具栏宿主。
- 新增稳定结构节点 ID、文档结构导航、面包屑及与 Hylo 桌面端共享的解析核心。
- 超过 512 KB 的文档改由带版本控制的后台 Worker 解析，避免旧结果覆盖新编辑。
- 改进完整 HTML 文档的 Word/PDF 导出、临时文件清理和原子写入保护。
- 补齐发布质量门禁，并精简 VSIX 中的源码、测试、vendor 和 source map。

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
