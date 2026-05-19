// ============================================================
// Hylo Node Map Manager (VS Code Edition)
// 从 Hylo 桌面版直接移植
// ============================================================

import type { SourceLocation } from "./types";

interface IndexEntry {
  nodeId: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export class NodeMapManager {
  private locationMap = new Map<string, SourceLocation>();
  private sortedIndex: IndexEntry[] = [];

  update(map: Map<string, SourceLocation>): void {
    this.locationMap = new Map(map);
    this.buildIndex();
  }

  getLocation(nodeId: string): SourceLocation | null {
    return this.locationMap.get(nodeId) ?? null;
  }

  /**
   * 根据字符偏移量查找最内层节点
   */
  findNodeAtOffset(offset: number): string | null {
    const candidates: IndexEntry[] = [];
    for (const entry of this.sortedIndex) {
      if (entry.startOffset > offset) break;
      if (entry.endOffset >= offset) {
        candidates.push(entry);
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        a.endOffset - a.startOffset - (b.endOffset - b.startOffset)
    );
    return candidates[0].nodeId;
  }

  /**
   * 根据行列号查找最内层节点（line/col 均为 1-based）
   */
  findNodeAtPosition(line: number, col: number): string | null {
    const candidates: IndexEntry[] = [];
    for (const entry of this.sortedIndex) {
      const afterStart =
        entry.startLine < line ||
        (entry.startLine === line && entry.startCol <= col);
      const beforeEnd =
        entry.endLine > line ||
        (entry.endLine === line && entry.endCol >= col);
      if (afterStart && beforeEnd) {
        candidates.push(entry);
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        a.endOffset - a.startOffset - (b.endOffset - b.startOffset)
    );
    return candidates[0].nodeId;
  }

  clear(): void {
    this.locationMap.clear();
    this.sortedIndex = [];
  }

  private buildIndex(): void {
    const entries: IndexEntry[] = [];
    for (const [nodeId, loc] of this.locationMap) {
      entries.push({
        nodeId,
        startOffset: loc.startOffset,
        endOffset: loc.endOffset,
        startLine: loc.startLine,
        startCol: loc.startCol,
        endLine: loc.endLine,
        endCol: loc.endCol,
      });
    }
    entries.sort((a, b) => a.startOffset - b.startOffset);
    this.sortedIndex = entries;
  }
}
