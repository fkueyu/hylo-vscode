// ============================================================
// Hylo VS Code Extension — Webview 脚本
// ============================================================

(function () {
  // 获取 VS Code API 实例
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const rootContainer = document.getElementById("hylo-root");
  const statsContainer = document.getElementById("hylo-stats");
  const emptyContainer = document.getElementById("hylo-empty");

  if (!rootContainer || !statsContainer || !emptyContainer) return;

  // 初始化 Shadow DOM
  const shadowRoot = rootContainer.shadowRoot || rootContainer.attachShadow({ mode: "open" });

  // 注入 Shadow DOM 内部隔离样式
  const shadowStyle = document.createElement("style");
  shadowStyle.textContent = `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
      color: var(--vscode-editor-foreground, #000000);
      background-color: var(--vscode-editor-background, #ffffff);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .hylo-preview-highlight {
      background: rgba(99, 102, 241, 0.15) !important;
      outline: 2px solid rgba(99, 102, 241, 0.6) !important;
      outline-offset: 1px;
      border-radius: 4px;
      transition: all 120ms ease;
    }
    [data-hylo-id]:hover {
      cursor: pointer;
      outline: 1px dashed rgba(99, 102, 241, 0.35);
      outline-offset: 1px;
      border-radius: 4px;
    }
    .hylo-preview-highlight:hover {
      outline: 2px solid rgba(99, 102, 241, 0.6) !important;
    }
  `;
  shadowRoot.appendChild(shadowStyle);

  // 用来盛放渲染内容的容器
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "ast-renderer";
  shadowRoot.appendChild(contentWrapper);

  // ── AST 渲染逻辑 ───────────────────────────────────────

  const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
  ]);

  const TRANSPARENT_TAGS = new Set(["html", "head", "body"]);

  /**
   * 将 HyloNode 转换为原生 DOM 节点
   */
  function createDOMNode(node) {
    if (node.type === "text") {
      return document.createTextNode(node.textContent || "");
    }

    if (node.type === "comment" || node.type === "doctype") {
      return null;
    }

    if (node.type === "document") {
      const fragment = document.createDocumentFragment();
      if (node.children) {
        for (const child of node.children) {
          const childDom = createDOMNode(child);
          if (childDom) fragment.appendChild(childDom);
        }
      }
      return fragment;
    }

    if (node.type === "element") {
      const tag = node.tagName.toLowerCase();

      // 对 html、head、body 节点直接打平子节点，不产生冗余包裹
      if (TRANSPARENT_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment();
        if (node.children) {
          for (const child of node.children) {
            const childDom = createDOMNode(child);
            if (childDom) fragment.appendChild(childDom);
          }
        }
        return fragment;
      }

      // 创建元素节点
      const el = document.createElement(tag);
      el.setAttribute("data-hylo-id", node.nodeId);

      // 设置属性
      if (node.attrs) {
        for (const [key, val] of Object.entries(node.attrs)) {
          // 排除内联事件监听，防止 XSS
          if (!key.startsWith("on")) {
            el.setAttribute(key, val);
          }
        }
      }

      // 递归处理子节点
      if (!VOID_ELEMENTS.has(tag) && tag !== "script" && node.children) {
        for (const child of node.children) {
          const childDom = createDOMNode(child);
          if (childDom) el.appendChild(childDom);
        }
      }

      return el;
    }

    return null;
  }

  // ── 事件监听与联动 ──────────────────────────────────────

  // 1. 点击预览元素，跳转源码 (Webview -> Extension)
  shadowRoot.addEventListener("click", (e) => {
    const path = e.composedPath();
    const target = path[0];
    if (!target || typeof target.closest !== "function") return;

    const nodeEl = target.closest("[data-hylo-id]");
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute("data-hylo-id");
      if (nodeId) {
        vscode.postMessage({ type: "click", nodeId });
      }
    }
  });

  // 2. 接收来自 Extension 的消息 (Extension -> Webview)
  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "update": {
        // 隐藏空白提示
        emptyContainer.classList.add("hidden");

        // 渲染新 AST
        const fragment = createDOMNode(message.ast);
        
        // 清理老内容（保留首个 style 标签）
        const children = Array.from(contentWrapper.childNodes);
        children.forEach(child => contentWrapper.removeChild(child));

        if (fragment) {
          contentWrapper.appendChild(fragment);
        }

        // 显示解析统计
        const stats = message.stats;
        statsContainer.innerText = `Nodes: ${stats.nodeCount} | Parse: ${stats.parseTime.toFixed(1)}ms`;
        break;
      }

      case "highlight": {
        const nodeId = message.nodeId;

        // 移除原有的高亮样式
        const prevHighlighted = shadowRoot.querySelectorAll(".hylo-preview-highlight");
        prevHighlighted.forEach((el) => el.classList.remove("hylo-preview-highlight"));

        if (nodeId) {
          const targetEl = shadowRoot.querySelector(`[data-hylo-id="${nodeId}"]`);
          if (targetEl) {
            targetEl.classList.add("hylo-preview-highlight");
            // 平滑滚动到可视区域
            targetEl.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
          }
        }
        break;
      }
    }
  });
})();
