(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HyloPreviewFrame = api;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    api.startFrameRuntime(window, document);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CHANNEL = "hylo-preview";
  const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
  ]);
  const TRANSPARENT_ELEMENTS = new Set(["html", "head"]);
  const ACTIVE_EMBED_ELEMENTS = new Set(["iframe", "object", "embed"]);
  const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i;

  function shouldExecuteScript(mode) {
    return mode === "interactive";
  }

  function sanitizeAttributes(attrs, mode) {
    const safe = {};
    for (const [rawName, rawValue] of Object.entries(attrs || {})) {
      const name = rawName.toLowerCase();
      const value = String(rawValue);
      if (name.startsWith("on") || name === "srcdoc") continue;
      if (["href", "src", "action", "formaction", "xlink:href"].includes(name)
        && DANGEROUS_URL.test(value)) continue;
      if (mode === "safe" && name === "http-equiv" && value.toLowerCase() === "refresh") continue;
      safe[rawName] = value;
    }
    return safe;
  }

  function startFrameRuntime(frameWindow, frameDocument) {
    const rootElement = frameDocument.body;
    if (!rootElement) return;

    let mode = "safe";
    let selectedNodeId = null;
    let pendingScripts = [];
    let activeScripts = [];
    const appliedRootAttributes = { html: new Set(), head: new Set(), body: new Set() };

    function findElement(node, tagName) {
      if (!node || typeof node !== "object") return null;
      if (node.type === "element" && String(node.tagName).toLowerCase() === tagName) return node;
      for (const child of node.children || []) {
        const found = findElement(child, tagName);
        if (found) return found;
      }
      return null;
    }

    function applyRootAttributes(ast) {
      for (const [tag, target] of [
        ["html", frameDocument.documentElement],
        ["head", frameDocument.head],
        ["body", frameDocument.body],
      ]) {
        for (const name of appliedRootAttributes[tag]) target.removeAttribute(name);
        appliedRootAttributes[tag].clear();
        const node = findElement(ast, tag);
        if (node?.nodeId) {
          target.setAttribute("data-hylo-id", node.nodeId);
          appliedRootAttributes[tag].add("data-hylo-id");
        }
        for (const [name, value] of Object.entries(sanitizeAttributes(node?.attrs, mode))) {
          if (tag === "html" && name.toLowerCase() === "style") continue;
          try {
            target.setAttribute(name, value);
            appliedRootAttributes[tag].add(name);
          } catch { /* invalid root attribute */ }
        }
      }
    }

    function post(message) {
      frameWindow.parent.postMessage({ channel: CHANNEL, ...message }, "*");
    }

    function applyBase(baseUri) {
      let base = frameDocument.head.querySelector("base");
      if (!baseUri) {
        base?.remove();
        return;
      }
      if (!base) {
        base = frameDocument.createElement("base");
        frameDocument.head.prepend(base);
      }
      if (base.getAttribute("href") !== baseUri) {
        base.setAttribute("href", baseUri);
      }
    }

    function createNode(node) {
      if (!node || typeof node !== "object") return null;
      if (node.type === "text") return frameDocument.createTextNode(node.textContent || "");
      if (node.type === "comment" || node.type === "doctype") return null;
      if (node.type === "document") {
        const fragment = frameDocument.createDocumentFragment();
        for (const child of node.children || []) {
          const childNode = createNode(child);
          if (childNode) fragment.appendChild(childNode);
        }
        return fragment;
      }
      if (node.type !== "element" || !node.tagName) return null;

      const tag = String(node.tagName).toLowerCase();
      if (tag === "script") {
        if (shouldExecuteScript(mode)) pendingScripts.push(node);
        return frameDocument.createComment("script blocked by Hylo preview boundary");
      }
      if (mode === "safe" && ACTIVE_EMBED_ELEMENTS.has(tag)) {
        return frameDocument.createComment(`${tag} blocked by Hylo safe preview`);
      }
      if (TRANSPARENT_ELEMENTS.has(tag) || tag === "body") {
        const fragment = frameDocument.createDocumentFragment();
        for (const child of node.children || []) {
          const childNode = createNode(child);
          if (childNode) fragment.appendChild(childNode);
        }
        return fragment;
      }

      const element = frameDocument.createElement(tag);
      if (node.nodeId) element.setAttribute("data-hylo-id", node.nodeId);
      for (const [name, value] of Object.entries(sanitizeAttributes(node.attrs, mode))) {
        try { element.setAttribute(name, value); } catch { /* invalid HTML attribute */ }
      }
      if (!VOID_ELEMENTS.has(tag)) {
        for (const child of node.children || []) {
          const childNode = createNode(child);
          if (childNode) element.appendChild(childNode);
        }
      }
      return element;
    }

    function runNextScript() {
      const node = pendingScripts.shift();
      if (!node) return;
      const script = frameDocument.createElement("script");
      const attrs = sanitizeAttributes(node.attrs, "interactive");
      for (const [name, value] of Object.entries(attrs)) script.setAttribute(name, value);
      let blobUrl = null;
      if (!attrs.src) {
        const content = node.children?.length === 1 && node.children[0].type === "text"
          ? node.children[0].textContent || ""
          : "";
        const wrapped = `try {\n{\n${content}\n}\n} catch (error) { console.error("Hylo preview script error", error); }`;
        blobUrl = frameWindow.URL.createObjectURL(new Blob([wrapped], { type: "text/javascript" }));
        script.src = blobUrl;
      }
      const complete = () => {
        if (blobUrl) frameWindow.URL.revokeObjectURL(blobUrl);
        runNextScript();
      };
      script.onload = complete;
      script.onerror = complete;
      frameDocument.head.appendChild(script);
      activeScripts.push(script);
    }

    function highlight(nodeId, scroll) {
      frameDocument.querySelectorAll(".hylo-preview-highlight").forEach((element) => {
        element.classList.remove("hylo-preview-highlight");
      });
      selectedNodeId = typeof nodeId === "string" ? nodeId : null;
      if (!selectedNodeId) return;
      const target = frameDocument.querySelector(`[data-hylo-id="${CSS.escape(selectedNodeId)}"]`);
      target?.classList.add("hylo-preview-highlight");
      if (scroll && target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function render(message) {
      const started = performance.now();
      mode = message.mode === "interactive" ? "interactive" : "safe";
      applyBase(message.baseUri);
      applyRootAttributes(message.ast);
      activeScripts.forEach((script) => script.remove());
      activeScripts = [];
      pendingScripts = [];
      const content = createNode(message.ast);
      rootElement.replaceChildren();
      if (content) rootElement.appendChild(content);
      highlight(message.highlightedNodeId, false);
      runNextScript();
      post({
        type: "render-stats",
        nodeCount: Number(message.stats?.nodeCount) || 0,
        renderTime: performance.now() - started,
      });
    }

    rootElement.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("a[href]")) event.preventDefault();
      const element = target.closest("[data-hylo-id]");
      const nodeId = element?.getAttribute("data-hylo-id");
      if (!nodeId) return;
      highlight(nodeId, false);
      post({ type: "node-selected", nodeId });
    }, true);

    frameWindow.addEventListener("message", (event) => {
      if (event.source !== frameWindow.parent) return;
      const message = event.data;
      if (!message || message.channel !== CHANNEL) return;
      if (message.type === "render") render(message);
      if (message.type === "highlight") highlight(message.nodeId, true);
    });

    post({ type: "preview-ready" });
  }

  return { sanitizeAttributes, shouldExecuteScript, startFrameRuntime };
});
