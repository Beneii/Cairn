# Troubleshooting Guide

Solutions for common CAIRN issues.

## Installation Problems

### Port already in use

**Problem:** `EADDRINUSE: address already in use :::5173`

**Solution:**

```bash
# Find process using port
lsof -i :5173

# Kill the process
kill -9 <PID>

# Or use different port
npm run dev -- --port 3000
```

### Dependencies fail to install

**Problem:** `npm ERR! code E...` during installation

**Solution:**

```bash
# Clear npm cache
npm cache clean --force

# Delete dependencies
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

With pnpm:
```bash
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Node version mismatch

**Problem:** "Node version 16.x is not supported"

**Solution:**

```bash
# Check version
node --version

# Upgrade Node to 18+
# Visit nodejs.org or use nvm

# Verify after upgrade
node --version
```

---

## Development Issues

### Dev server won't start

**Problem:** Server starts but `http://localhost:5173` doesn't load

**Solution:**

1. Check if server is actually running:
   ```bash
   npm run dev
   ```
   Should show: `➜  Local:   http://localhost:5173/`

2. Check browser console (F12) for errors
3. Try a different browser
4. Clear browser cache

### Hot reload not working

**Problem:** Changes don't appear after save

**Solution:**

1. Check dev server is running:
   ```bash
   npm run dev
   ```

2. Check file path is within `src/` directory

3. Restart dev server:
   ```bash
   Ctrl+C
   npm run dev
   ```

### TypeScript errors in editor

**Problem:** Red squiggles but `npm run build` works

**Solution:**

1. Restart editor
2. Check TypeScript version:
   ```bash
   npm ls typescript
   ```
3. Verify `tsconfig.json` exists

### Build fails but editor says OK

**Problem:** `npm run build` shows errors, but editor shows no errors

**Solution:**

1. Run build to see real errors:
   ```bash
   npm run build
   ```

2. Check editor's TypeScript version settings

3. Sync editor TypeScript version with project:
   - VS Code: Select TypeScript version in bottom status bar

---

## Component Issues

### Component doesn't render

**Problem:** Component appears blank or missing

**Solution:**

1. Check component is imported in `App.tsx`:
   ```typescript
   import { MyComponent } from "./components/cairn/MyComponent";
   ```

2. Check component returns valid JSX:
   ```typescript
   return <div>Content</div>;  // ✅ Good
   return null;                 // ❌ If returning null, component won't show
   ```

3. Check console for error messages

### Styles not applied

**Problem:** Tailwind classes don't work

**Solution:**

1. Check class syntax:
   ```tsx
   // ✅ Good
   <div className="bg-white p-4">

   // ❌ Bad (missing className)
   <div class="bg-white p-4">

   // ❌ Bad (typo in class)
   <div className="bg-whte p-4">
   ```

2. Restart dev server (config changes need reload)

3. Check `tailwind.config.ts` for template paths

### Animation stutters

**Problem:** Nucleus or other animation is choppy

**Solution:**

1. Check GPU acceleration in DevTools:
   - Open DevTools > Rendering
   - Check "Paint flashing" to see repaints

2. Reduce animation complexity

3. Check browser performance:
   - Close other tabs
   - Check CPU usage
   - Try different browser

### Props not updating

**Problem:** Component receives new props but doesn't re-render

**Solution:**

1. Check if using `memo` correctly:
   ```typescript
   export const MyComponent = memo(({ prop }: Props) => {
     // Must pass dependencies if using useCallback
   });
   ```

2. Check state vs props:
   - If using local state, component won't update from props
   - Lift state up to parent if needed

3. Check console for errors

---

## Performance Issues

### App is slow

**Problem:** Interactions lag, animations stutter

**Solution:**

1. Check DevTools Performance tab:
   ```
   DevTools > Performance > Record
   Interact with app
   Stop recording
   Analyze results
   ```

2. Look for:
   - Long tasks (>50ms)
   - Excessive re-renders
   - Large render times

3. Optimize hot spots:
   - Add `memo` to expensive components
   - Move state down
   - Split components

### Large bundle size

**Problem:** `npm run build` produces huge files

**Solution:**

1. Check bundle size:
   ```bash
   npm run build -- --stats
   ```

2. Look for:
   - Unused dependencies
   - Large libraries
   - Code duplication

3. Optimize:
   - Remove unused dependencies
   - Code split pages
   - Use dynamic imports

---

## API / Backend Issues

### Can't connect to backend

**Problem:** API calls fail, CORS errors, timeouts

**Solution:**

(Backend not yet implemented - these are for future)

1. Check API URL in environment
2. Check backend is running
3. Check CORS headers
4. Check firewall/network

---

## Browser Issues

### Works on Chrome, not Firefox

**Problem:** Features broken in specific browser

**Solution:**

1. Check browser support:
   - Chrome, Firefox, Safari, Edge (latest)

2. Open DevTools in problem browser
3. Check console for errors
4. Try in different browser version

### Responsive design broken

**Problem:** Mobile/tablet layout wrong

**Solution:**

1. Check viewport meta tag in `index.html`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```

2. Test with DevTools device emulation

3. Check Tailwind breakpoints:
   ```tsx
   <div className="flex-col md:flex-row">
   ```

---

## Git / Version Control Issues

### Can't push code

**Problem:** `git push` fails

**Solution:**

```bash
# Check remote
git remote -v

# Update local branch
git fetch origin
git rebase origin/main

# Try push again
git push
```

### Merge conflicts

**Problem:** Conflicts during rebase/merge

**Solution:**

1. Open conflicted files
2. Look for `<<<<< ===== >>>>>`
3. Edit to keep desired code
4. Stage changes:
   ```bash
   git add .
   git rebase --continue
   ```

---

## Getting Help

Still stuck?

1. **Check [FAQ](faq.md)** — Common questions
2. **Check [Glossary](glossary.md)** — Terminology
3. **Read [Code Style](../06-contributing/code-style.md)** — Standards
4. **Review [Documentation Index](../00-INDEX.md)** — All docs

### Report a Bug

Create GitHub issue with:
- Description
- Steps to reproduce
- Expected vs actual
- Screenshots
- Browser/OS info

### Ask a Question

Open GitHub discussion or check existing issues.

---

## Common Error Messages

### "Cannot find module"

**Cause:** Import path wrong or file doesn't exist

**Fix:**
```bash
# Check file exists
ls src/app/components/cairn/MyComponent.tsx

# Fix import path
import { MyComponent } from "./MyComponent";  // ✅ Correct
import { MyComponent } from "./mycomponent";  // ❌ Wrong (case sensitive)
```

### "Property does not exist"

**Cause:** TypeScript type error

**Fix:**
```typescript
// Check type definition
interface Props {
  name: string;
  // age missing
}

// ❌ This fails - age doesn't exist
<Component name="Alice" age={30} />

// ✅ Add age to Props
interface Props {
  name: string;
  age: number;  // Added
}
```

### "useState is not a hook"

**Cause:** React import missing

**Fix:**
```typescript
// ✅ Good
import { useState } from "react";

// ❌ Bad - no import
const [count, setCount] = useState(0);
```

---

## Performance Debugging Checklist

- [ ] DevTools Performance tab: identify slow operations
- [ ] React DevTools: check for excessive re-renders
- [ ] Network tab: check API response times
- [ ] Console: any errors or warnings?
- [ ] Bundle size: is it bloated?
- [ ] Browser: sufficient hardware?

---

See [FAQ](faq.md) or [Glossary](glossary.md) for more help.
