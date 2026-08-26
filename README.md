# Hylo — HTML Live Preview ✦

> **HTML 的 Typora** — 实时 HTML 预览与源码双向联动编辑器。
> **Typora for HTML** — Real-time HTML live preview with bi-directional syncing.

### 🔗 链接 / Links
* 🌐 [官方网站 & App 下载 / Official Site & App Download](https://ainx.ink/hylo/)
* 🐙 [GitHub 仓库 / GitHub Repository](https://github.com/fkueyu/hylo-vscode)
* 📦 [VS Code 插件市场 / VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview)

---

## 🌟 推荐：下载 Hylo 桌面端 App / Recommended: Download Hylo Desktop App

如果您需要更纯粹、更沉浸的 HTML 交互编辑体验，我们强烈推荐您下载 **Hylo 桌面端应用**。
*If you are looking for a more immersive and standalone HTML editing experience, we highly recommend downloading the **Hylo Desktop App**.*

* 💻 **更强大的内置编辑器 (Built-in Monaco Editor)**：搭载与 VS Code 相同的 Monaco 编辑器内核，支持完整的代码自动补全、多光标编辑和各种快捷键。
* 🖥️ **独立窗口，专注体验 (Standalone Interface)**：告别 VS Code 拥挤的侧边栏与多窗口干扰，提供专为 HTML 渲染和交互设计的无缝沉浸式工作区。
* 📦 **一键发布与导出 (One-Click Export & Publish)**：原生客户端支持更丰富的文件管理与项目导出方案。
* 📥 [**Mac App Store 下载 / Download on the Mac App Store**](https://apps.apple.com/cn/app/hylo-editor/id6771771702?mt=12)
* 📥 [**Windows 客户端下载 / Download Windows Client**](https://github.com/fkueyu/hylo/releases)
* 🌐 [**前往官方网站 / Visit Official Website**](https://ainx.ink/hylo/)

---

## ⚡ 核心特性 / Key Features

### 🇨🇳 中文介绍
* **双向联动同步**：在左侧代码区移动光标或选中标签，右侧预览自动高亮对应元素并平滑滚动定位；在右侧预览区点击任意元素，左侧编辑器光标瞬间精准跳转到对应的代码行。
* **文档结构导航**：预览顶部显示当前元素层级，可展开文档结构抽屉并从任意节点同时定位源码与预览。
* **高精度 AST 解析**：基于高精度 parse5 解析引擎，维护精准的节点源码映射位置（Source Locations），完美兼容复杂、嵌套甚至不规范的 HTML。
* **大文档后台解析**：超过 512 KB 的文档自动交给版本化 Worker 解析，避免阻塞扩展主线程并丢弃过期结果。
* **安全预览与沙盒 iframe**：默认阻止文档脚本与远程资源，用户页面运行在无同源权限的沙盒 iframe 中，自定义样式不会覆盖插件工具栏。
* **工作区信任保护**：只有受信任的 Workspace 才能主动开启交互预览，并在隔离 iframe 内加载 HTTPS 脚本与 CDN。
* **零配置，即开即用**：无需配置任何端口、本地服务器，开箱即用。
* **Tailwind & CDN 支持**：完美支持在 `<head>` 中引入 Tailwind CSS 等前端框架 CDN，支持毫秒级页面热更新。

### 🇬🇧 English Description
* **Bi-directional Syncing**: Moving the code cursor or selecting a tag highlights the corresponding element in the preview and scrolls it into view. Clicking any element in the preview instantly jumps the editor cursor to the exact line of code.
* **Document Structure Navigation**: The preview shows the current element path and provides an optional outline drawer for locating both source and rendered nodes.
* **High-Precision AST Mapping**: Powered by the robust `parse5` HTML parser, maintaining accurate Source Maps (Locations) of DOM nodes, even for complex, nested, or malformed HTML structures.
* **Background parsing for large documents**: Documents above 512 KB move to a versioned Worker so stale results cannot replace newer edits.
* **Safe Preview in a sandbox iframe**: Document scripts and remote resources are blocked by default, while user styles remain isolated from the extension toolbar.
* **Workspace Trust protection**: Interactive Preview can be enabled only in trusted workspaces and runs HTTPS scripts inside the isolated frame.
* **Zero Configuration**: Ready to use out of the box. No local server, ports, or setup required.
* **Tailwind CSS & CDNs**: Seamlessly loads framework scripts (like Tailwind CSS) imported in the `<head>` tag, providing instant rendering updates.

---

## 🚀 如何使用 / How to Use

### 🇨🇳 中文说明
1. 打开任意 `.html` 文件；
2. 点击编辑器右上角标题栏的 **Hylo 预览图标**（或按下 `Cmd+Shift+P` / `Ctrl+Shift+P` 打开命令面板，输入 **`Hylo: Open HTML Preview`**）；
3. 编辑左侧源码，右侧即可进行实时双向交互预览。

### 🇬🇧 English Instructions
1. Open any `.html` file inside VS Code;
2. Click the **Hylo Preview Icon** in the editor's top-right title bar (or open Command Palette with `Cmd+Shift+P` / `Ctrl+Shift+P` and search for **`Hylo: Open HTML Preview`**);
3. Edit your HTML on the left and see the bi-directional live preview on the right.

---

## 💡 常见问题与提示 / FAQ & Tips

#### Q: 为什么预览区没有加载我的 CSS 样式？/ Why is my custom CSS not rendering?
* **中文**：安全预览支持内联 `<style>` 与本地相对资源，但会阻止网络 CDN。若工作区可信，可点击顶部“交互预览”后加载 HTTPS 样式与脚本。
* **English**: Safe Preview supports inline styles and local relative resources while blocking network CDNs. In a trusted workspace, switch to Interactive Preview to load HTTPS styles and scripts.

#### Q: 插件如何加载 Tailwind CSS？/ How to load Tailwind CSS?
* **中文**：先确认工作区受信任并开启“交互预览”，再在 HTML 的 `<head>` 中引入 HTTPS Tailwind CDN：
  ```html
  <script src="https://cdn.tailwindcss.com"></script>
  ```
* **English**: Trust the workspace, enable Interactive Preview, then include the HTTPS Tailwind CDN script in `<head>`:
  ```html
  <script src="https://cdn.tailwindcss.com"></script>
  ```

---

## 🐞 问题反馈 / Feedback
* [👉 Submit an Issue on GitHub](https://github.com/fkueyu/hylo-vscode/issues)
