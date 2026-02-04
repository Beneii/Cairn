# Git Workflow

Development process for CAIRN contributions.

## Branch Naming

Use descriptive branch names:

```
feature/nucleus-animation        # New feature
bugfix/chat-message-overflow     # Bug fix
docs/architecture-guide          # Documentation
refactor/component-structure     # Refactoring
test/nucleus-animation           # Tests
```

## Commits

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Code style, formatting
- `refactor` — Code refactoring
- `test` — Adding tests
- `chore` — Build, dependencies, etc.

**Scope:** Component or area affected (e.g., `nucleus`, `chat`, `ui`)

**Subject:**
- Lowercase
- Imperative mood ("add", "fix", not "added", "fixes")
- No period at end
- Max 50 characters

### Examples

```
feat(nucleus): add tooling state animation
fix(chat): prevent message overflow in sidebar
docs: update architecture overview
refactor(kanban): simplify card rendering
test(types): add validation tests
```

### Commit Body

For complex changes, add a body:

```
feat(nucleus): add sub-agent visualization

When nucleus enters "tooling" state, sub-agents now appear as
orbiting blobs around the main nucleus. Each blob is labeled with
the sub-agent's name and current action.

Fixes #123
```

## Pull Requests

### PR Title

Same format as commits:

```
feat(nucleus): add tooling state animation
```

### PR Description

```markdown
## Summary

What does this PR do? Brief description.

## Related Issues

Closes #123
Related to #456

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How to test these changes:

1. Step 1
2. Step 2
3. Verify result

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. **Request review** from maintainers
2. **Address feedback** with new commits (don't amend)
3. **Re-request review** after changes
4. **Merge** after approval

## Workflow

### 1. Create Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

```bash
# Edit files
npm run lint -- --fix
npm run build
```

### 3. Commit

```bash
git add src/
git commit -m "feat(component): add new feature"
```

### 4. Push

```bash
git push -u origin feature/my-feature
```

### 5. Create PR

Open PR on GitHub, fill in template.

### 6. Address Feedback

```bash
# Make changes
git add src/
git commit -m "address review feedback"  # New commit, don't amend
git push
```

### 7. Merge

After approval:

```bash
# Squash commits if many
git rebase -i origin/main
git push --force-with-lease
```

Or let GitHub merge with "Squash and merge".

## Keep Branches Updated

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

## Useful Commands

```bash
# View logs
git log --oneline -10

# Check status
git status

# Diff current changes
git diff

# Amend last commit (before push)
git commit --amend --no-edit

# Undo last commit (before push)
git reset --soft HEAD~1

# View branch
git branch -a
```

## Code Review Checklist

Reviewers check:

- [ ] Code follows style guidelines
- [ ] Types are correct (no `any`)
- [ ] Tests cover the changes
- [ ] No performance regressions
- [ ] Documentation is updated
- [ ] Commits are well-organized

## Questions?

See [Code Style Guide](code-style.md) for standards.
