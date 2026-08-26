// Hylo VS Code trusted Webview shell.
// User HTML is rendered only inside #hylo-preview-frame.
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();
  const frame = document.getElementById("hylo-preview-frame");
  const statsContainer = document.getElementById("hylo-stats");
  const emptyContainer = document.getElementById("hylo-empty");
  const workspace = document.getElementById("hylo-workspace");
  const outlinePanel = document.getElementById("hylo-outline");
  const outlineTree = document.getElementById("hylo-outline-tree");
  const outlineCount = document.getElementById("hylo-outline-count");
  const outlineToggle = document.getElementById("hylo-outline-toggle");
  const modeToggle = document.getElementById("hylo-mode-toggle");
  const modeHint = document.getElementById("hylo-mode-hint");
  const breadcrumb = document.getElementById("hylo-breadcrumb");
  const structure = globalThis.HyloStructure;

  if (
    !(frame instanceof HTMLIFrameElement) || !statsContainer || !emptyContainer ||
    !workspace || !outlinePanel || !outlineTree || !outlineCount || !outlineToggle ||
    !modeToggle || !modeHint || !breadcrumb || !structure
  ) return;

  const CHANNEL = "hylo-preview";
  const sessionToken = frame.dataset.session || "";
  const safeFrameSrc = frame.dataset.safeSrc || "";
  const interactiveFrameSrc = frame.dataset.interactiveSrc || "";
  let outlineOpen = Boolean((vscode.getState() || {}).outlineOpen);
  let currentAst = null;
  let selectedNodeId = null;
  let currentMode = "safe";
  let workspaceTrusted = false;
  let frameReady = false;
  let lastUpdate = null;
  const collapsedNodeIds = new Set();

  function rebuildFrame() {
    frameReady = false;
    frame.src = currentMode === "interactive" ? interactiveFrameSrc : safeFrameSrc;
  }

  function postToFrame(message) {
    if (!frameReady || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ channel: CHANNEL, ...message }, "*");
  }

  function sendLastUpdate() {
    if (!lastUpdate) return;
    postToFrame({
      type: "render",
      ast: lastUpdate.ast,
      stats: lastUpdate.stats,
      baseUri: lastUpdate.baseUri,
      mode: currentMode,
      highlightedNodeId: selectedNodeId,
    });
  }

  function updateModeUi() {
    const interactive = currentMode === "interactive";
    modeToggle.textContent = interactive
      ? modeToggle.dataset.interactiveLabel || "Interactive Preview"
      : modeToggle.dataset.safeLabel || "Safe Preview";
    modeToggle.classList.toggle("is-interactive", interactive);
    modeToggle.setAttribute("aria-pressed", String(interactive));
    modeToggle.disabled = !workspaceTrusted;
    modeHint.textContent = interactive ? "" : modeHint.dataset.safeHint || "";
  }

  function applyMode(mode, trusted) {
    workspaceTrusted = Boolean(trusted);
    const resolved = mode === "interactive" && workspaceTrusted ? "interactive" : "safe";
    const changed = resolved !== currentMode;
    currentMode = resolved;
    updateModeUi();
    if (changed) rebuildFrame();
  }

  function updateOutlineVisibility() {
    workspace.classList.toggle("hylo-outline-open", outlineOpen);
    outlineToggle.classList.toggle("is-active", outlineOpen);
    outlineToggle.setAttribute("aria-expanded", String(outlineOpen));
    const label = outlineOpen ? outlineToggle.dataset.hideLabel : outlineToggle.dataset.showLabel;
    if (label) {
      outlineToggle.title = label;
      outlineToggle.setAttribute("aria-label", label);
    }
  }

  function renderBreadcrumb() {
    breadcrumb.replaceChildren();
    const trail = currentAst && selectedNodeId
      ? structure.findNodeTrail(currentAst, selectedNodeId)
      : [];
    if (trail.length === 0) {
      const hint = document.createElement("span");
      hint.className = "hylo-breadcrumb__hint";
      hint.textContent = breadcrumb.dataset.emptyLabel || "";
      breadcrumb.appendChild(hint);
      return;
    }
    trail.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "hylo-breadcrumb__separator";
        separator.textContent = "/";
        breadcrumb.appendChild(separator);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${item.tagName}${item.detail}`;
      button.addEventListener("click", () => selectNode(item.nodeId, true, true));
      breadcrumb.appendChild(button);
    });
  }

  function syncSelectedOutlineNode() {
    outlineTree.querySelectorAll(".hylo-outline-node.is-selected").forEach((node) => {
      node.classList.remove("is-selected");
    });
    if (!selectedNodeId) return;
    const row = outlineTree.querySelector(`[data-outline-node-id="${CSS.escape(selectedNodeId)}"]`);
    row?.classList.add("is-selected");
    row?.scrollIntoView({ block: "nearest" });
  }

  function selectNode(nodeId, notifyExtension, scrollPreview) {
    selectedNodeId = typeof nodeId === "string" ? nodeId : null;
    renderBreadcrumb();
    syncSelectedOutlineNode();
    postToFrame({ type: "highlight", nodeId: selectedNodeId, scroll: scrollPreview !== false });
    if (notifyExtension && selectedNodeId) {
      vscode.postMessage({ type: "click", nodeId: selectedNodeId, sessionToken });
    }
  }

  function createOutlineBranch(item, depth) {
    const branch = document.createElement("div");
    const row = document.createElement("div");
    row.className = "hylo-outline-node";
    row.dataset.outlineNodeId = item.nodeId;
    row.style.setProperty("--hylo-outline-depth", String(depth));
    const hasChildren = item.children.length > 0;
    const children = document.createElement("div");

    if (hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "hylo-outline-node__toggle";
      toggle.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4" /></svg>';
      toggle.setAttribute("aria-expanded", String(!collapsedNodeIds.has(item.nodeId)));
      toggle.addEventListener("click", () => {
        if (collapsedNodeIds.has(item.nodeId)) collapsedNodeIds.delete(item.nodeId);
        else collapsedNodeIds.add(item.nodeId);
        const collapsed = collapsedNodeIds.has(item.nodeId);
        toggle.setAttribute("aria-expanded", String(!collapsed));
        children.hidden = collapsed;
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "hylo-outline-node__spacer";
      row.appendChild(spacer);
    }

    const target = document.createElement("button");
    target.type = "button";
    target.className = "hylo-outline-node__target";
    target.title = `${item.tagName}${item.detail}`;
    const tag = document.createElement("span");
    tag.textContent = item.tagName;
    target.appendChild(tag);
    if (item.detail) {
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      target.appendChild(detail);
    }
    target.addEventListener("click", () => selectNode(item.nodeId, true, true));
    row.appendChild(target);
    branch.appendChild(row);

    if (hasChildren) {
      children.hidden = collapsedNodeIds.has(item.nodeId);
      item.children.forEach((child) => children.appendChild(createOutlineBranch(child, depth + 1)));
      branch.appendChild(children);
    }
    return branch;
  }

  function renderOutline(ast) {
    const items = structure.buildDocumentOutline(ast);
    outlineTree.replaceChildren();
    outlineCount.textContent = String(structure.countOutlineItems(items));
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hylo-outline__empty";
      empty.textContent = outlinePanel.dataset.emptyLabel || "";
      outlineTree.appendChild(empty);
      return;
    }
    items.forEach((item) => outlineTree.appendChild(createOutlineBranch(item, 0)));
    syncSelectedOutlineNode();
  }

  outlineToggle.addEventListener("click", () => {
    outlineOpen = !outlineOpen;
    vscode.setState({ outlineOpen });
    updateOutlineVisibility();
  });

  modeToggle.addEventListener("click", () => {
    const requested = currentMode === "safe" ? "interactive" : "safe";
    vscode.postMessage({ type: "setPreviewMode", mode: requested, sessionToken });
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window && event.source !== null) {
      if (event.source !== frame.contentWindow || message?.channel !== CHANNEL) return;
      if (message.type === "preview-ready") {
        frameReady = true;
        sendLastUpdate();
      } else if (message.type === "node-selected" && typeof message.nodeId === "string") {
        selectNode(message.nodeId, true, false);
      }
      return;
    }

    if (!message || typeof message.type !== "string" || message.sessionToken !== sessionToken) return;
    if (message.type === "update") {
      lastUpdate = message;
      currentAst = message.ast;
      applyMode(message.mode, message.workspaceTrusted);
      if (selectedNodeId && structure.findNodeTrail(currentAst, selectedNodeId).length === 0) {
        selectedNodeId = null;
      }
      emptyContainer.classList.add("hidden");
      renderOutline(currentAst);
      renderBreadcrumb();
      const label = statsContainer.dataset.nodeLabel || "nodes";
      statsContainer.textContent = `${message.stats.nodeCount} ${label} · ${message.stats.parseTime.toFixed(1)} ms`;
      if (currentMode === "interactive" && frameReady) rebuildFrame();
      else sendLastUpdate();
    } else if (message.type === "highlight") {
      selectNode(message.nodeId, false, true);
    } else if (message.type === "previewMode") {
      applyMode(message.mode, message.workspaceTrusted);
    } else if (message.type === "parsing") {
      lastUpdate = null;
      currentAst = null;
      selectedNodeId = null;
      outlineTree.replaceChildren();
      outlineCount.textContent = "0";
      renderBreadcrumb();
      statsContainer.textContent = statsContainer.dataset.parsingLabel || "Parsing…";
      rebuildFrame();
    }
  });

  updateOutlineVisibility();
  updateModeUi();
  rebuildFrame();
  vscode.postMessage({ type: "ready", sessionToken });
})();
