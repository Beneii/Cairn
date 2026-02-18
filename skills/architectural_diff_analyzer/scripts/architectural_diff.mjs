#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const start = Date.now();
const root = process.cwd();
const beforePath = process.argv[2];
const afterPath = process.argv[3];
const outputPath = process.argv[4] || path.join(root, 'documents', 'metrics', 'architectural-diff.json');
if (!beforePath || !afterPath) {
  console.error('usage: node architectural_diff.mjs <before> <after> [output]');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
const after = JSON.parse(fs.readFileSync(afterPath, 'utf8'));

const beforeOrder = new Map((before.topologicalOrder || []).map((n, i) => [n, i]));
let orderChanges = 0;
for (const [i, name] of (after.topologicalOrder || []).entries()) {
  if (beforeOrder.has(name) && beforeOrder.get(name) !== i) orderChanges++;
}

const diff = {
  generatedAt: new Date().toISOString(),
  beforePath,
  afterPath,
  nodeDelta: (after.nodeCount || 0) - (before.nodeCount || 0),
  edgeDelta: (after.edgeCount || 0) - (before.edgeCount || 0),
  orphanDelta: ((after.orphans || []).length) - ((before.orphans || []).length),
  cycleChanged: Boolean(before.hasCycle) !== Boolean(after.hasCycle),
  orderChanges
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(diff, null, 2));

const metricsPath = path.join(root, 'documents', 'metrics', 'architectural-diff.metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify({ durationMs: Date.now() - start, ...diff }, null, 2));
console.log(`architectural_diff_analyzer wrote ${outputPath}`);
