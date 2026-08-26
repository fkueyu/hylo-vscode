const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDocumentOutline,
  countOutlineItems,
  findNodeTrail,
} = require("../media/document-structure.js");

const location = {
  startLine: 1,
  startCol: 1,
  endLine: 1,
  endCol: 2,
  startOffset: 0,
  endOffset: 1,
};

function element(nodeId, tagName, attrs = {}, children = [], sourceLocation = location) {
  return { nodeId, type: "element", tagName, attrs, children, sourceLocation };
}

const tree = {
  nodeId: "document",
  type: "document",
  sourceLocation: null,
  children: [
    element("html", "html", {}, [
      element("body", "body", {}, [
        element("main", "main", { id: "app" }, [
          { nodeId: "text", type: "text", textContent: "hello", sourceLocation: location },
          element("section", "section", { class: "hero featured" }),
          element("implicit", "div", {}, [element("button", "button")], null),
        ]),
      ], null),
    ], null),
  ],
};

test("buildDocumentOutline promotes editable descendants of implicit wrappers", () => {
  assert.deepEqual(buildDocumentOutline(tree), [
    {
      nodeId: "main",
      tagName: "main",
      detail: "#app",
      children: [
        { nodeId: "section", tagName: "section", detail: ".hero", children: [] },
        { nodeId: "button", tagName: "button", detail: "", children: [] },
      ],
    },
  ]);
});

test("findNodeTrail returns the semantic path used by the selection breadcrumb", () => {
  assert.deepEqual(
    findNodeTrail(tree, "section").map((item) => `${item.tagName}${item.detail}`),
    ["html", "body", "main#app", "section.hero"],
  );
  assert.deepEqual(findNodeTrail(tree, "missing"), []);
});

test("countOutlineItems counts every editable element in the outline", () => {
  assert.equal(countOutlineItems(buildDocumentOutline(tree)), 3);
});
