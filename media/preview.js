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
  // 暂存当前解析出的 script 节点，待 DOM 树挂载完成后统一在 document.head 中按顺序执行
  let pendingScripts = [];

  function processNextScript() {
    if (pendingScripts.length === 0) {
      // 【终极渲染修复】：
      // 针对 Tailwind CDN 异步生成 CSS 的特性，第一次渲染时由于 CSS 还在生成中，
      // DOM 元素的尺寸和布局都是错乱的，这会导致用户代码中的 IntersectionObserver 计算错误（比如 fade-in 无法触发）。
      // 当我们在首次加载完成并执行完所有脚本后，延迟 300ms（等待 Tailwind 生成 CSS），
      // 然后向插件发送 `requestUpdate` 强制触发一次完全基于带样式 DOM 的二次渲染，
      // 从而完美还原“点击一下屏幕就修好”的行为。
      if (!window.__hyloFirstRenderDone) {
        window.__hyloFirstRenderDone = true;
        setTimeout(() => {
          // @ts-ignore
          if (typeof vscode !== "undefined") {
            vscode.postMessage({ type: "requestUpdate" });
          }
        }, 300);
      }
      return;
    }
    const scriptNode = pendingScripts.shift();
    const src = scriptNode.attrs?.src;

    if (src) {
      // 外链脚本
      if (!document.head.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement("script");
        for (const [key, val] of Object.entries(scriptNode.attrs || {})) {
          script.setAttribute(key, val);
        }
        script.onload = () => { processNextScript(); };
        script.onerror = () => { processNextScript(); };
        document.head.appendChild(script);
      } else {
        // 已加载，直接执行下一个
        processNextScript();
      }
    } else {
      // 内联脚本
      const innerContent = scriptNode.children?.length === 1 && scriptNode.children[0].type === "text"
        ? scriptNode.children[0].textContent || ""
        : "";
      if (innerContent) {
        const script = document.createElement("script");
        if (scriptNode.attrs) {
          for (const [key, val] of Object.entries(scriptNode.attrs)) {
            script.setAttribute(key, val);
          }
        }
        // 使用 try-catch 保护内联脚本执行
        script.textContent = `try {\n{\n${innerContent}\n}\n} catch (e) {\n  console.error("Hylo inline script error:", e);\n}`;
        document.head.appendChild(script);
        activeInlineScripts.push(script);
      }
      processNextScript();
    }
  }

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

      // script 标签加入暂存列表，等待 DOM 挂载完毕后执行
      if (tag === "script") {
        pendingScripts.push(node);
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
        if (message.baseUri) {
          let baseEl = document.head.querySelector("base");
          if (!baseEl) {
            baseEl = document.createElement("base");
            document.head.insertBefore(baseEl, document.head.firstChild);
          }
          baseEl.href = message.baseUri;
        }

        // 隐藏空白提示
        emptyContainer.classList.add("hidden");

        // 清理上一次渲染的内联脚本节点，防止 DOM 膨胀
        activeInlineScripts.forEach(script => script.remove());
        activeInlineScripts = [];
        pendingScripts = [];

        // 渲染新 AST 并暂存其中的脚本
        const fragment = createDOMNode(message.ast);

        // 【核心修复】：智能提权 Tailwind 配置脚本
        // 在实际开发中，开发者有时会将 tailwind.config 脚本放在 CDN 脚本之后。
        // 原生浏览器遇到 CDN 脚本时会阻塞解析，此时 DOM 还未完全 Ready，所以 Tailwind 会等待；
        // 但在我们的 Webview 中，AST 是一次性注入的（document.readyState 已经是 complete）。
        // Tailwind CDN 一旦执行就会**立刻同步**读取配置。如果配置脚本排在后面，就会读取为空。
        // 因此我们必须把所有包含 tailwind.config 的内联脚本“提权”到最前面执行！
        const hoisted = [];
        const others = [];
        for (const node of pendingScripts) {
          if (!node.attrs?.src) {
            const innerContent = node.children?.length === 1 && node.children[0].type === "text"
              ? node.children[0].textContent || ""
              : "";
            if (innerContent.includes("tailwind.config")) {
              hoisted.push(node);
              continue;
            }
          }
          others.push(node);
        }
        pendingScripts = [...hoisted, ...others];
        
        // 清理老内容
        const children = Array.from(contentWrapper.childNodes);
        children.forEach(child => contentWrapper.removeChild(child));

        if (fragment) {
          contentWrapper.appendChild(fragment);
        }

        // 此时所有 DOM 元素均已正式挂载到文档中，开始按严格的顺序（队列）执行脚本
        // 这样可以确保内联的 tailwind.config = ... 在 CDN 脚本加载前立刻执行
        processNextScript();

        // 诊断日志 (自动输出在 Webview 控制台)
        console.log("=== Hylo VS Code Preview Update Diagnostic ===");
        console.log("1. Tailwind 脚本是否存在于 Head:", !!document.head.querySelector('script[src*="tailwindcss"]'));
        console.log("2. window.tailwind 对象状态:", window.tailwind);
        console.log("3. 页面已生成样式表数量:", document.querySelectorAll('style').length);
        console.log("4. 预览容器 DOM 节点前 300 字符:", contentWrapper.innerHTML.slice(0, 300));
        console.log("5. fade-in 元素总数:", document.querySelectorAll('.fade-in').length);
        console.log("6. 已激活的 fade-in 元素数:", document.querySelectorAll('.fade-in.active').length);

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

  // 发送 ready 握手信号给插件，表示 Webview 监听已就绪，请求发送初始内容
  vscode.postMessage({ type: "ready" });
})();
