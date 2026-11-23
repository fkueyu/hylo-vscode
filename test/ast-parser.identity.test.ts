import assert from "node:assert/strict";
import test from "node:test";

import { parseHTML } from "../src/ast-parser.ts";
import type { HyloNode } from "../src/types.ts";

function elementId(root: HyloNode, tagName: string): string {
  if (root.type === "element" && root.tagName === tagName) return root.nodeId;
  for (const child of root.children ?? []) {
    const found = elementId(child, tagName);
    if (found) return found;
  }
  return "";
}

test("parsing unchanged HTML preserves element identities", () => {
  const first = parseHTML("<main><section>Hello</section></main>");
  const second = parseHTML("<main><section>Hello</section></main>");
  assert.equal(elementId(first.root, "section"), elementId(second.root, "section"));
});

test("editing text preserves surrounding element identities", () => {
  const first = parseHTML("<main><section>Hello</section></main>");
  const second = parseHTML("<main><section>Hello world</section></main>");
  assert.equal(elementId(first.root, "main"), elementId(second.root, "main"));
  assert.equal(elementId(first.root, "section"), elementId(second.root, "section"));
});

test("inserting a different tag keeps existing element identities", () => {
  const first = parseHTML("<main><section><p>Hello</p></section></main>");
  const second = parseHTML("<main><div>new block</div><section><p>Hello</p></section></main>");
  assert.equal(elementId(first.root, "main"), elementId(second.root, "main"));
  assert.equal(elementId(first.root, "section"), elementId(second.root, "section"));
  assert.equal(elementId(first.root, "p"), elementId(second.root, "p"));
});

test("explicit id anchors identity against same-tag sibling insertion", () => {
  const first = parseHTML('<main><section id="intro"><p>a</p></section></main>');
  const second = parseHTML(
    '<main><section><p>z</p></section><section id="intro"><p>a</p></section></main>',
  );
  const collectSections = (root: HyloNode): string[] => {
    const ids: string[] = [];
    const visit = (node: HyloNode) => {
      if (node.type === "element" && node.tagName === "section") ids.push(node.nodeId);
      for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return ids;
  };
  const firstIds = collectSections(first.root);
  const secondIds = collectSections(second.root);
  assert.equal(firstIds.length, 1);
  assert.equal(secondIds.length, 2);
  assert.ok(secondIds.includes(firstIds[0]));
});

test("text node identities survive text edits", () => {
  const first = parseHTML("<p>Hello</p>");
  const second = parseHTML("<p>Hello world</p>");
  const textIds = (root: HyloNode): string[] => {
    const ids: string[] = [];
    const visit = (node: HyloNode) => {
      if (node.type === "text") ids.push(node.nodeId);
      for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return ids;
  };
  assert.deepEqual(textIds(second.root), textIds(first.root));
});

test("duplicate ids keep node map keys unique", () => {
  const parsed = parseHTML('<div id="dup"></div><div id="dup"></div>');
  const ids = [...parsed.nodeMap.keys()];
  assert.equal(ids.filter((id) => id.includes("div_id_dup")).length, 2);
  assert.equal(new Set(ids).size, ids.length);
});
