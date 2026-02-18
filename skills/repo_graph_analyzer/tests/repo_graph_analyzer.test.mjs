import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'documents', 'repo-graph.json');

execSync('node skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs', { stdio: 'inherit' });
const graph = JSON.parse(fs.readFileSync(out, 'utf8'));

assert.ok(graph.nodeCount > 0, 'expected at least one node');
assert.ok(Array.isArray(graph.edges), 'edges should be array');
assert.ok(Array.isArray(graph.topologicalOrder), 'topologicalOrder should be array');

console.log('repo_graph_analyzer test passed');
