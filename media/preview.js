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

  // 追踪动态执行的内联脚本，在更新前进行清理，防止 DOM 树中历史脚本节点无限堆积
  let activeInlineScripts = [];

  // 直接将渲染内容挂载到 rootContainer，不再使用 Shadow DOM，以确保 Tailwind CSS 样式能正确作用于预览内容
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "ast-renderer";
  rootContainer.appendChild(contentWrapper);

  // ── AST 渲染逻辑 ───────────────────────────────────────

  const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
  ]);

  const TRANSPARENT_TAGS = new Set(["html", "head"]);

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

      // 对 html、head 节点直接打平子节点，不产生冗余包裹
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

      // script 标签特殊处理，支持实际执行
      if (tag === "script") {
        const src = node.attrs?.src;
        if (src) {
          // 外链脚本排重
          if (!document.head.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement("script");
            for (const [key, val] of Object.entries(node.attrs)) {
              script.setAttribute(key, val);
            }
            document.head.appendChild(script);
          }
        } else {
          // 内联脚本执行
          const innerContent = node.children?.length === 1 && node.children[0].type === "text"
            ? node.children[0].textContent || ""
            : "";
          if (innerContent) {
            const script = document.createElement("script");
            if (node.attrs) {
              for (const [key, val] of Object.entries(node.attrs)) {
                script.setAttribute(key, val);
              }
            }
            // 使用 try { { ... } } 块级作用域包裹
            script.textContent = `try {\n{\n${innerContent}\n}\n} catch (e) {\n  console.error("Hylo inline script error:", e);\n}`;
            document.head.appendChild(script);
            activeInlineScripts.push(script);
          }
        }
        return document.createComment("script placeholder");
      }

      return el;
    }

    return null;
  }

  // ── 事件监听与联动 ──────────────────────────────────────

  // 1. 点击预览元素，跳转源码 (Webview -> Extension)
  rootContainer.addEventListener("click", (e) => {
    const target = e.target;
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

        // 清理上一次渲染的内联脚本节点，防止 DOM 膨胀
        activeInlineScripts.forEach(script => script.remove());
        activeInlineScripts = [];

        // 渲染新 AST
        const fragment = createDOMNode(message.ast);
        
        // 清理老内容
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
        const prevHighlighted = rootContainer.querySelectorAll(".hylo-preview-highlight");
        prevHighlighted.forEach((el) => el.classList.remove("hylo-preview-highlight"));

        if (nodeId) {
          const targetEl = rootContainer.querySelector(`[data-hylo-id="${nodeId}"]`);
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
