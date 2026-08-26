import { parentPort } from "node:worker_threads";
import { parseHTML } from "@ainx/hylo-core";

interface ParseRequest {
  version: number;
  html: string;
}

parentPort?.on("message", ({ version, html }: ParseRequest) => {
  const result = parseHTML(html);
  parentPort?.postMessage({
    version,
    root: result.root,
    nodeMap: [...result.nodeMap],
    parseTime: result.parseTime,
    nodeCount: result.nodeCount,
  });
});
