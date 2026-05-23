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
* 📥 [**点击这里前往官网下载桌面版 App / Click here to download the Desktop App**](https://ainx.ink/hylo/)

---

## ⚡ 核心特性 / Key Features

### 🇨🇳 中文介绍
* **双向联动同步**：在左侧代码区移动光标或选中标签，右侧预览自动高亮对应元素并平滑滚动定位；在右侧预览区点击任意元素，左侧编辑器光标瞬间精准跳转到对应的代码行。
* **高精度 AST 解析**：基于高精度 parse5 解析引擎，维护精准的节点源码映射位置（Source Locations），完美兼容复杂、嵌套甚至不规范的 HTML。
* **独立的沙盒隔离**：基于 Shadow DOM 将预览样式与 VS Code 完全隔离，确保您的自定义样式绝不污染编辑器本身。
* **零配置，即开即用**：无需配置任何端口、本地服务器，开箱即用。
* **Tailwind & CDN 支持**：完美支持在 `<head>` 中引入 Tailwind CSS 等前端框架 CDN，支持毫秒级页面热更新。

### 🇬🇧 English Description
* **Bi-directional Syncing**: Moving the code cursor or selecting a tag highlights the corresponding element in the preview and scrolls it into view. Clicking any element in the preview instantly jumps the editor cursor to the exact line of code.
* **High-Precision AST Mapping**: Powered by the robust `parse5` HTML parser, maintaining accurate Source Maps (Locations) of DOM nodes, even for complex, nested, or malformed HTML structures.
* **Shadow DOM Sandboxing**: Uses Shadow DOM to strictly isolate the preview styles from VS Code's editor styles, ensuring your custom CSS never pollutes the editor's UI.
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
* **中文**：为了保障编辑器的安全，预览区是沙盒隔离的。请确保您的 HTML 中有 `<style>` 标签或 `<link rel="stylesheet">` 样式表引入。本插件支持本地相对路径和网络 CDN 地址。
* **English**: To prevent style bleeding into the editor, the preview runs in a sandboxed Shadow DOM. Make sure your HTML includes inline `<style>` tags or `<link rel="stylesheet">` files. Both relative paths and remote CDNs are fully supported.

#### Q: 插件如何加载 Tailwind CSS？/ How to load Tailwind CSS?
* **中文**：直接在 HTML 的 `<head>` 中像下面这样引入 Tailwind 官方 CDN 即可：
  ```html
  <script src="https://cdn.tailwindcss.com"></script>
  ```
* **English**: Simply include the official Tailwind CDN script inside your HTML's `<head>` tag:
  ```html
  <script src="https://cdn.tailwindcss.com"></script>
  ```

---

## 🐞 问题反馈 / Feedback
* [👉 Submit an Issue on GitHub](https://github.com/fkueyu/hylo-vscode/issues)
