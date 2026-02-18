#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const start = Date.now();
const rootPath = process.argv[2] || process.cwd();
const outputPath = process.argv[3] || path.join(rootPath, 'documents', 'repo-graph.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getWorkspaceDirs(root) {
  const ws = path.join(root, 'pnpm-workspace.yaml');
  if (!fs.existsSync(ws)) return [];
  const text = fs.readFileSync(ws, 'utf8');
  const globs = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).replace(/['"]/g, ''));

  const dirs = [];
  for (const g of globs) {
    if (!g.endsWith('/*')) continue;
    const parent = path.join(root, g.slice(0, -2));
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(path.join(parent, entry.name));
    }
  }
  return dirs;
}

const pkgDirs = getWorkspaceDirs(rootPath).filter((d) => fs.existsSync(path.join(d, 'package.json')));
const nodes = pkgDirs.map((d) => {
  const pkg = readJson(path.join(d, 'package.json'));
  return { name: pkg.name, dir: path.relative(rootPath, d), dependencies: { ...pkg.dependencies, ...pkg.devDependencies } };
});

const names = new Set(nodes.map((n) => n.name));
const edges = [];
for (const n of nodes) {
  for (const dep of Object.keys(n.dependencies || {})) {
    if (names.has(dep)) edges.push({ from: n.name, to: dep });
  }
}

const dependencyCount = new Map(nodes.map((n) => [n.name, 0]));
const dependersByDependency = new Map(nodes.map((n) => [n.name, []]));
for (const e of edges) {
  dependencyCount.set(e.from, (dependencyCount.get(e.from) || 0) + 1);
  dependersByDependency.get(e.to).push(e.from);
}

const q = [...[...dependencyCount.entries()].filter(([, d]) => d === 0).map(([k]) => k)];
const topo = [];
while (q.length) {
  const cur = q.shift();
  topo.push(cur);
  for (const depender of dependersByDependency.get(cur) || []) {
    dependencyCount.set(depender, dependencyCount.get(depender) - 1);
    if (dependencyCount.get(depender) === 0) q.push(depender);
  }
}

const hasCycle = topo.length !== nodes.length;
const outgoingByNode = new Map(nodes.map((n) => [n.name, []]));
const incomingByNode = new Map(nodes.map((n) => [n.name, []]));
for (const e of edges) {
  outgoingByNode.get(e.from).push(e.to);
  incomingByNode.get(e.to).push(e.from);
}
const orphans = nodes
  .filter((n) => (outgoingByNode.get(n.name) || []).length === 0 && (incomingByNode.get(n.name) || []).length === 0)
  .map((n) => n.name);
const topoPos = new Map(topo.map((name, i) => [name, i]));
const topologicalViolations = edges.filter((e) => (topoPos.get(e.to) ?? Number.POSITIVE_INFINITY) > (topoPos.get(e.from) ?? -1)).length;

const graph = {
  generatedAt: new Date().toISOString(),
  rootPath,
  nodeCount: nodes.length,
  edgeCount: edges.length,
  hasCycle,
  nodes: nodes.map((n) => ({ name: n.name, dir: n.dir })),
  edges,
  topologicalOrder: topo,
  topologicalViolations,
  orphans
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

const metricsPath = path.join(rootPath, 'documents', 'metrics', 'repo-graph-analyzer.metrics.json');
fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
fs.writeFileSync(metricsPath, JSON.stringify({ nodeCount: graph.nodeCount, edgeCount: graph.edgeCount, orphans: graph.orphans.length, hasCycle, topologicalViolations: graph.topologicalViolations, durationMs: Date.now() - start }, null, 2));

console.log(`repo_graph_analyzer wrote ${outputPath}`);
