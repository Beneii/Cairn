# Running the UI

Guide to developing and running the CAIRN UI locally.

## Quick Start

```bash
cd UI
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Development Server

### Starting the Server

```bash
npm run dev
```

Output:
```
  VITE v6.3.5  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

The server runs with hot module replacement (HMR) — changes to files automatically reload in the browser without losing state.

### Stopping the Server

Press `Ctrl+C` in the terminal running the dev server.

### Using a Different Port

```bash
npm run dev -- --port 3000
```

## Understanding the Current State

The UI is a **prototype with mock data**. Everything you see is static:

- **Nucleus animation** — Cycles through states (idle → thinking → tooling → waiting → error) every 6 seconds
- **Chat messages** — Hardcoded example conversation
- **Notes** — Sample inbox entries
- **Kanban cards** — Fixed task board
- **Logs** — Demo activity log
- **Pages** — Navigation works but all data is mock

### Where Mock Data Lives

Check [App.tsx](../../UI/src/app/App.tsx) for hardcoded data:

```typescript
// Example mock data structure
const INITIAL_NOTES = [
  { id: "1", content: "Refine Nucleus animation logic", status: "unread", timestamp: "10:00" },
  { id: "2", content: "Check API usage limits", status: "read", timestamp: "09:30" }
];

const INITIAL_CHAT = [
  { id: "1", role: "user", text: "System status check.", timestamp: "10:05" },
  { id: "2", role: "cairn", text: "All systems nominal.", timestamp: "10:05" }
];
```

## File Structure

Key files for development:

```
UI/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # Main app component (mock data, routing)
│   │   └── components/
│   │       ├── cairn/
│   │       │   ├── Nucleus.tsx     # Physics-based animation
│   │       │   ├── Chat.tsx        # Chat interface
│   │       │   ├── Notes.tsx       # Inbox system
│   │       │   ├── Kanban.tsx      # Task board
│   │       │   ├── Logs.tsx        # Activity log
│   │       │   ├── types.ts        # TypeScript interfaces
│   │       │   ├── Nucleus.module.css
│   │       │   └── [other components...]
│   │       ├── ui/                 # shadcn/ui components
│   │       └── figma/              # Figma utilities
│   └── styles/
│       └── globals.css             # Global styles
├── index.html                      # Entry HTML
├── vite.config.ts                  # Vite configuration
├── tsconfig.json                   # TypeScript config
└── tailwind.config.ts              # Tailwind config
```

## Hot Reload in Action

When developing:

1. **Modify a component** — e.g., change text in Chat.tsx
2. **Save the file** — Editor auto-saves (if enabled)
3. **Browser updates** — Page refreshes with changes, no state loss

Try it:
```bash
# In your editor, modify UI/src/app/components/cairn/Chat.tsx
# Change a message text and save
# Watch the browser update in real-time
```

## Debugging

### Browser DevTools

Open browser DevTools (F12 or Cmd+Option+I) to:

- **Inspect elements** — Right-click any component
- **View console** — Check for errors or logs
- **React DevTools** — Install extension to see component tree
- **Network tab** — Monitor API calls (when backend connects)

### Console Logging

Add console logs to debug:

```typescript
// In any React component
useEffect(() => {
  console.log("Component mounted", props);
}, [props]);
```

View logs in browser DevTools Console tab.

### Vite Error Overlay

Vite shows errors directly in the browser:

```typescript
// This will show an error in the browser
const undefined_variable = nonexistent.property;  // ❌ Shows error in browser
```

Fix it and save — error disappears.

## Building for Production

### Production Build

```bash
npm run build
```

Creates optimized bundle in `dist/` directory:
- Minified JavaScript
- Optimized CSS
- Static asset hashing

### Preview Production Build

```bash
npm run preview
```

Runs a local server with the production build. This simulates how your app will run on a real server.

## Linting & Code Quality

### Check Code Quality

```bash
npm run lint
```

Shows TypeScript errors and ESLint warnings. Fix them before committing.

### Auto-format Code

If configured:
```bash
npm run format  # Auto-format code
```

## Project Configuration

### Vite Config

[vite.config.ts](../../UI/vite.config.ts) sets up:

- **React plugin** — JSX/TSX support
- **Path aliases** — `@` maps to `./src`
- **Tailwind CSS** — Vite plugin for v4
- **Asset includes** — SVG and CSV files

### TypeScript Config

[tsconfig.json](../../UI/tsconfig.json) sets:

- **Target** — ES2020
- **JSX** — React JSX transform
- **Strict mode** — Strict type checking
- **Module resolution** — Node-style

### Tailwind Config

[tailwind.config.ts](../../UI/tailwind.config.ts) defines:

- **Color scheme** — Custom colors
- **Typography** — Font sizes, line heights
- **Spacing** — Margin, padding scales
- **Plugins** — Animation plugins

## Common Development Tasks

### Adding a New Component

1. Create file in `UI/src/app/components/cairn/NewComponent.tsx`
2. Define TypeScript interfaces in `types.ts`
3. Import in `App.tsx` and use it
4. Document in [Component Docs](../03-ui-components/overview.md)

See [Adding UI Components Guide](../05-guides/adding-components.md) for details.

### Modifying an Existing Component

1. Open component file (e.g., `Chat.tsx`)
2. Make changes
3. Save — browser auto-updates
4. Test in DevTools
5. Update documentation if needed

### Adding a New Page

1. Create component in `UI/src/app/components/`
2. Add routing in `App.tsx`
3. Add navigation link
4. Document the page

### Working with Animations

Animations use [Framer Motion](https://www.framer.com/motion/):

```typescript
import { motion } from "motion/react";

<motion.div
  animate={{ x: 100 }}
  transition={{ duration: 0.5 }}
>
  Animated content
</motion.div>
```

See [Nucleus.tsx](../../UI/src/app/components/cairn/Nucleus.tsx) for complex animation example.

### Working with Styling

Use Tailwind CSS classes for styling:

```tsx
<div className="bg-white text-lg font-bold px-4 py-2">
  Styled with Tailwind
</div>
```

For component-specific styles, use CSS modules:

```typescript
// In component file
import styles from "./MyComponent.module.css";

<div className={styles.container}>
  Content
</div>
```

## Performance Tips

### Optimize Animations

- Use GPU-accelerated properties (x, y, scale, opacity)
- Avoid animating width, height, left, top (use transform instead)
- Use `will-change` sparingly
- Profile with DevTools Performance tab

### Code Splitting

- Split large pages into separate chunks
- Use dynamic imports: `const Page = lazy(() => import("./Page"))`
- See build size with `npm run build -- --stats`

### React Optimization

- Use `memo` to prevent unnecessary re-renders
- Use `useCallback` for stable function references
- Check DevTools Profiler for render bottlenecks

## Troubleshooting Development

### Stale DevTools Extension

If React DevTools shows nothing:
1. Disable and re-enable the extension
2. Restart the browser

### CSS Not Updating

If Tailwind classes don't work:
1. Check class name syntax (no typos)
2. Restart dev server (hot reload doesn't always catch config changes)
3. Check `tailwind.config.ts` for template paths

### TypeScript Errors in Editor

If your editor shows errors but build succeeds:
1. Restart your editor
2. Check TypeScript version: `npm ls typescript`
3. Run `npm run lint` to see actual errors

### Module Not Found

If import fails:
1. Check file path is correct
2. Verify path alias in `vite.config.ts`
3. Check file extension (.ts, .tsx, .css, etc.)

## Next Steps

- **Add a component** — Follow [Adding UI Components Guide](../05-guides/adding-components.md)
- **Understand architecture** — Read [Architecture Overview](../02-architecture/overview.md)
- **Explore code** — Browse [UI Components Docs](../03-ui-components/overview.md)
- **Review components** — Check out [Nucleus](../03-ui-components/nucleus.md), [Chat](../03-ui-components/chat.md), etc.

## Commands Summary

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Check code quality |
| `npm install` | Install/update dependencies |

For more info, see [Installation Guide](installation.md) or [Development Workflow](development-workflow.md).
