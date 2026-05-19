# Hylo — HTML Live Preview ✦

> **HTML 的 Typora** — 实时 HTML 预览与源码双向联动编辑器。
> **Typora for HTML** — Real-time HTML live preview with bi-directional syncing.

---

[官网 / Official Site](https://ainx.org/hylo) | [GitHub](https://github.com/ainx-org/hylo-vscode)

无需离开 VS Code，即可在编写 HTML 文件时实现“源码”与“预览”的无缝双向联动：
Write HTML inside VS Code with a fluid, bi-directional live sync preview:

- **源码 → 预览 (Code to Preview)**：在编辑器中移动光标或选中标签，右侧预览面板自动高亮对应的渲染元素并滚动至可视区域。
  *Moving the editor cursor automatically highlights the corresponding preview element and scrolls it into view.*
- **预览 → 源码 (Preview to Code)**：点击预览面板中的任意渲染元素，左侧编辑器光标瞬间定位并滚动至该元素对应的确切代码行。
  *Clicking any rendered element in the preview panel instantly jumps the editor cursor to its exact line of code.*

---

## ⚡ 核心特性 / Key Features

* **双向联动同步 (Bi-directional Syncing)**：代码光标移动与预览高亮元素互相同步，告别在大量 HTML 代码中肉眼寻找对应节点的痛苦。
* **高精度 AST 语法树 (High-Precision AST Parsing)**：底层基于高精度 parse5 解析引擎，维护精确的节点位置映射（Source Maps），即使遇到复杂、嵌套或不规范的 HTML 结构，依然能精准定位。
* **独立的沙盒隔离 (Isolated Sandbox)**：使用 Shadow DOM 将预览页面与 VS Code 自身的样式进行彻底隔离，您的 custom CSS 绝对不会污染编辑器的界面布局。
* **零配置，即开即用 (Zero Configuration)**：无需配置任何端口、本地服务器或依赖项，对任何 `.html` 文件一键开启。

---

## 🚀 如何使用 / How to Use

1. 打开任何一个 `.html` 文件。
   *Open any `.html` file.*
2. 点击编辑器右上角标题栏的 **Hylo 预览图标**（或按下 `Cmd+Shift+P` / `Ctrl+Shift+P` 打开命令面板，输入 **`Hylo: Open HTML Preview`**）。
   *Click the **Hylo Preview Icon** in the top-right title bar of the editor (or open the Command Palette and type **`Hylo: Open HTML Preview`**).*
3. 在左侧编辑源码，在右侧实时双向交互！
   *Edit code on the left, interact with live preview on the right!*

---

## 💡 常见问题与提示 / FAQ & Tips

#### 1. 为什么预览区没有渲染我的 CSS 样式？/ Why is my custom CSS not rendering?
为了防止用户代码污染编辑器，预览面板运行在沙盒化的 Shadow DOM 中。要想让预览区渲染样式，请确保在您的 HTML 文件中：
- 编写了 `<style>` 标签，或
- 引入了外部样式表（例如 `<link rel="stylesheet" href="path/to/style.css">`），支持相对路径或网络 URL。

#### 2. 是否支持 Tailwind CSS 或 CDN 框架？/ Does it support Tailwind CSS or CDNs?
支持！只要在 HTML 文档的 `<head>` 中引入 Tailwind CDN 脚本或相关框架脚本即可：
```html
<script src="https://cdn.tailwindcss.com"></script>
```
预览沙盒会自动加载该脚本，并在预览区以毫秒级响应渲染您的 Tailwind 样式。

---

## 🐞 问题反馈 / Feedback

如果您在使用过程中遇到任何 Bug 或有新的 feature 建议，请提交至我们的 GitHub Issues 页面，我们会第一时间进行跟进与优化：
[👉 提交 Issue / Report a Bug](https://github.com/ainx-org/hylo-vscode/issues)
