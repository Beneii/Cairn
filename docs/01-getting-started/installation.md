# Installation

Get CAIRN up and running on your machine.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** — Download from [nodejs.org](https://nodejs.org/)
- **pnpm** (or npm/yarn) — Package manager
  ```bash
  npm install -g pnpm
  ```
- **Git** — For version control
- **Code editor** — VS Code recommended

Verify installation:
```bash
node --version      # Should be v18.0.0 or higher
npm --version       # Should be 9.0.0 or higher
pnpm --version      # Should be 8.0.0 or higher (if using pnpm)
```

## Installation Steps

### 1. Clone or Download the Repository

```bash
git clone <repository-url> cairn
cd cairn
```

Or if you already have the directory:
```bash
cd /path/to/Cairn
```

### 2. Install UI Dependencies

Navigate to the UI directory and install dependencies:

```bash
cd UI
npm install
```

Or with pnpm:
```bash
cd UI
pnpm install
```

**What's being installed:**
- React 18.3.1 — UI framework
- Vite 6.3.5 — Build tool
- TypeScript — Type safety
- Tailwind CSS — Styling
- Framer Motion — Animations
- shadcn/ui + Radix UI — Component library

### 3. Verify Installation

Check that everything installed correctly:

```bash
npm ls react
npm ls vite
npm ls typescript
```

## Project Structure After Installation

```
Cairn/
├── README.md                  # Main entry point
├── truth.md                   # Architecture specification
├── docs/                      # Documentation
├── UI/                        # React frontend
│   ├── node_modules/         # Dependencies (created by npm install)
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   └── styles/
│   ├── public/               # Static files
│   ├── vite.config.ts        # Vite configuration
│   ├── tsconfig.json         # TypeScript configuration
│   ├── package.json          # Dependencies list
│   └── package-lock.json     # Dependency lock file
└── .claude/                  # Claude configuration
```

## Running the UI

Start the development server:

```bash
cd UI
npm run dev
```

You should see output like:
```
  VITE v6.3.5  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The UI will load with mock data demonstrating:

- **Nucleus** — Animated state visualization that cycles through system states
- **Chat** — Mock conversation interface
- **Notes** — Example inbox messages
- **Kanban** — Sample task board
- **Logs** — System activity log
- **Navigation** — Agents, Integrations, Preferences pages

### Hot Reload

The development server supports hot reload. When you modify files in `src/`, the browser automatically refreshes. No need to restart the server.

## Configuration

### Environment Variables

The UI currently works with defaults. Optional configuration in `UI/.env` (create if needed):

```bash
# Placeholder for future backend API URL
VITE_API_URL=http://localhost:3000  # (Not yet used)

# Placeholder for future analytics
VITE_TELEMETRY=false  # (Not yet used)
```

Current UI doesn't use these — they're placeholders for future backend integration.

## Troubleshooting

### "Port 5173 already in use"

Another process is using port 5173. Either:

1. Kill the process using the port:
   ```bash
   # On macOS/Linux:
   lsof -i :5173
   kill -9 <PID>

   # On Windows:
   netstat -ano | findstr :5173
   taskkill /PID <PID> /F
   ```

2. Or use a different port:
   ```bash
   npm run dev -- --port 5174
   ```

### "node_modules not found"

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### "TypeScript errors"

If you see TypeScript errors in your editor:

1. Restart your editor (it may have stale type info)
2. Run `npm run build` to check for real build errors
3. Check that TypeScript version matches: `npm ls typescript`

### "Dependencies fail to install"

Try clearing npm cache:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

If using pnpm:
```bash
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### "Vite config errors"

Make sure your `vite.config.ts` exists and is correctly formatted. Run:
```bash
npm run build
```

This will show any configuration issues.

## Next Steps

1. **Read the README** — Understand the core concepts
   ```bash
   cd ..  # Go to Cairn root
   cat README.md
   ```

2. **Explore the UI** — Click around, see how the components work
   - Watch the Nucleus animation
   - Review mock data in Chat and Notes
   - Check the Logs panel

3. **Read Architecture** — Understand the six-service design
   - [Architecture Overview](../02-architecture/overview.md)
   - [Core Principles](../07-reference/core-principles.md)

4. **Build Components** — Add your own UI components
   - [Adding UI Components Guide](../05-guides/adding-components.md)
   - [UI Components Documentation](../03-ui-components/overview.md)

## Getting Help

- **Installation problems?** Check [Troubleshooting](../07-reference/troubleshooting.md)
- **Questions?** See [FAQ](../07-reference/faq.md)
- **More info?** Browse the [Documentation Index](../00-INDEX.md)

## Development Commands

Once installed, use these commands:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm run lint` | Check code quality |
| `npm run preview` | Preview production build locally |

See [Running the UI](running-ui.md) for detailed usage information.
