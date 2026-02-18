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

const indeg = new Map(nodes.map((n) => [n.name, 0]));
const out = new Map(nodes.map((n) => [n.name, []]));
for (const e of edges) {
  indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
  out.get(e.from).push(e.to);
}

const q = [...[...indeg.entries()].filter(([, d]) => d === 0).map(([k]) => k)];
const topo = [];
while (q.length) {
  const cur = q.shift();
  topo.push(cur);
  for (const next of out.get(cur) || []) {
    indeg.set(next, indeg.get(next) - 1);
    if (indeg.get(next) === 0) q.push(next);
  }
}

const hasCycle = topo.length !== nodes.length;
const orphans = nodes.filter((n) => (out.get(n.name) || []).length === 0 && !edges.some((e) => e.to === n.name)).map((n) => n.name);

const graph = {
  generatedAt: new Date().toISOString(),
  rootPath,
  nodeCount: nodes.length,
  edgeCount: edges.length,
  hasCycle,
  nodes: nodes.map((n) => ({ name: n.name, dir: n.dir })),
  edges,
  topologicalOrder: topo,
  orphans
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

const metricsPath = path.join(rootPath, 'documents', 'metrics', 'repo-graph-analyzer.metrics.json');
fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
fs.writeFileSync(metricsPath, JSON.stringify({ nodeCount: graph.nodeCount, edgeCount: graph.edgeCount, orphans: graph.orphans.length, hasCycle, durationMs: Date.now() - start }, null, 2));

console.log(`repo_graph_analyzer wrote ${outputPath}`);
