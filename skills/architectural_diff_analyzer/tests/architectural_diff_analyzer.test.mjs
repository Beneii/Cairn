import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const before = path.join(root, 'documents', 'repo-graph.before.json');
const after = path.join(root, 'documents', 'repo-graph.json');

execSync('node skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs', { stdio: 'inherit' });
fs.copyFileSync(after, before);
execSync('node skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs', { stdio: 'inherit' });
execSync(`node skills/architectural_diff_analyzer/scripts/architectural_diff.mjs "${before}" "${after}"`, { stdio: 'inherit' });

const diff = JSON.parse(fs.readFileSync(path.join(root, 'documents', 'metrics', 'architectural-diff.json'), 'utf8'));
assert.equal(typeof diff.nodeDelta, 'number');
assert.equal(typeof diff.edgeDelta, 'number');
assert.equal(typeof diff.orderChanges, 'number');
console.log('architectural_diff_analyzer test passed');
