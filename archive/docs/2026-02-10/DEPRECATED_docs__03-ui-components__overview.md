# UI Components Overview

Guide to CAIRN's production-ready React component library.

## Architecture

CAIRN's UI is built on these principles:

- **UI is Truth** — All system state is visible
- **Clear Separation** — Each component owns a single concern
- **Responsive Design** — Works on desktop, tablet, mobile
- **Accessible** — Keyboard navigation, screen readers
- **Animated** — State changes are smooth, not jarring
- **Type-Safe** — Full TypeScript support

## Component Organization

```
UI/src/app/components/
├── cairn/                    # Core CAIRN components
│   ├── Nucleus.tsx          # Physics-based animation
│   ├── Chat.tsx             # Conversation interface
│   ├── Notes.tsx            # Inbox system
│   ├── Kanban.tsx           # Task board
│   ├── Logs.tsx             # Activity log
│   ├── types.ts             # Shared TypeScript interfaces
│   └── *.module.css         # Component styles
├── ui/                       # shadcn/ui components
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── tooltip.tsx
│   └── [50+ others]
└── figma/                    # Figma utilities
```

## Core Components

### Nucleus

**Purpose:** Visualize system state through physics-based animation.

**States:**
- `idle` — Gentle drift
- `thinking` — Fast orbital spin
- `tooling` — Expansion with sub-agent budding
- `waiting` — Nearly frozen
- `error` — Rapid jitter

**File:** [Nucleus.tsx](../../UI/src/app/components/cairn/Nucleus.tsx)

**Docs:** [Nucleus Component](nucleus.md)

### Chat

**Purpose:** Display user-agent conversation.

**Features:**
- User and agent message types
- Collapsible tool outputs
- Timestamp and role labels
- Monospace font for technical clarity

**File:** [Chat.tsx](../../UI/src/app/components/cairn/Chat.tsx)

**Docs:** [Chat Component](chat.md)

### Notes

**Purpose:** Inbox system for agent-generated messages (replaces prompt-stuffing).

**Features:**
- Read/unread states
- Visual differentiation
- Message resurfacing
- Direct text input

**File:** [Notes.tsx](../../UI/src/app/components/cairn/Notes.tsx)

**Docs:** [Notes Component](notes.md)

### Kanban

**Purpose:** Visualize task state across four columns.

**Columns:**
- Backlog — Not started
- Active — In progress
- Blocked — Waiting for something
- Done — Completed

**Features:**
- Card count per column
- Visual task tracking
- Future drag-and-drop support

**File:** [Kanban.tsx](../../UI/src/app/components/cairn/Kanban.tsx)

**Docs:** [Kanban Component](kanban.md)

### Logs

**Purpose:** Real-time system activity monitoring.

**Log Types:**
- `thought` — Agent reasoning
- `tool` — Tool execution
- `file` — File operations
- `api` — API calls
- `agent` — Agent state changes
- `error` — System errors

**Features:**
- Type-based filtering
- Timestamp display
- Icon indicators
- Monospace formatting

**File:** [Logs.tsx](../../UI/src/app/components/cairn/Logs.tsx)

**Docs:** [Logs Component](logs.md)

## Navigation

The main navigation includes three pages accessible from the sidebar:

### Agents Page

Shows orchestration graph visualization:
- Agent nodes with names and states
- Connection lines showing call graph
- Visual representation of orchestration

**File:** [AgentsPage.tsx](../../UI/src/app/components/cairn/AgentsPage.tsx)

### Integrations Page

Manages external service connections:
- API keys and credentials
- Integration enable/disable
- Service configuration

**File:** [IntegrationsPage.tsx](../../UI/src/app/components/cairn/IntegrationsPage.tsx)

### Preferences Page

System configuration:
- Theme selection (light/dark)
- Heartbeat interval settings
- Billing and cost preferences

**File:** [PreferencesPage.tsx](../../UI/src/app/components/cairn/PreferencesPage.tsx)

## Design System

### Styling Framework

**Tailwind CSS 4.1.12** — Utility-first CSS framework

- Responsive design with breakpoints
- Dark mode support
- Custom color palette
- Spacing and sizing scales

### Component Library

**shadcn/ui** (50+ components)

- Radix UI primitives
- Customizable, copyable components
- TypeScript support
- Accessible by default

**Material UI**

- Icon system
- Additional components
- Professional look

**Lucide Icons**

- 400+ SVG icons
- Consistent sizing and style
- Built-in React component

### Color Palette

```
Primary:  #000000 (black)
Secondary: #666666 (gray)
Success:  #10b981 (emerald)
Error:    #ef4444 (red)
Warning:  #f59e0b (amber)
Info:     #3b82f6 (blue)

Dark mode inverts contrast
```

## Animation Library

**Framer Motion 12.23.24** — Production-ready animation

Key animation features:
- Spring physics
- Gestures (hover, tap, drag)
- SVG path animations
- Layout animations

### Example: Nucleus Animation

The Nucleus uses continuous animation loop:

```typescript
useAnimationFrame((_, delta) => {
  // Physics-based motion calculation
  // Smooth interpolation between states
  // GPU-accelerated transforms
});
```

See [Nucleus.tsx](../../UI/src/app/components/cairn/Nucleus.tsx) for implementation.

## Layout Structure

### Main Layout

```
┌─────────────────────────────────────────┐
│            Header / Navigation           │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │      Main Content Area      │
│          │                              │
│  - Chat  │  (Selected component)        │
│  - Notes │                              │
│  - Kanban│  ┌────────────────────────┐ │
│  - Logs  │  │  Component content     │ │
│  - Pages │  │  (varies by selection) │ │
│          │  └────────────────────────┘ │
│          │                              │
└──────────┴──────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | <640px | Stacked |
| Tablet | 640-1024px | Sidebar collapses |
| Desktop | >1024px | Full layout |

## TypeScript Interfaces

All components use type-safe interfaces from [types.ts](../../UI/src/app/components/cairn/types.ts):

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "cairn";
  text: string;
  timestamp: string;
  tools?: string[];
}

interface Note {
  id: string;
  content: string;
  status: "unread" | "read";
  timestamp: string;
}

interface KanbanCard {
  id: string;
  title: string;
  status: "backlog" | "active" | "blocked" | "done";
}

// See types.ts for complete definitions
```

See [Types Documentation](types.md) for full reference.

## Current State

### ✅ Complete

- Nucleus animation (physics-based, all states)
- Chat interface (display, no input)
- Notes system (mock data)
- Kanban board (visual, no drag yet)
- Logs viewer (filtering, display)
- Navigation pages (mockups)
- Component library (50+ shadcn/ui components)
- Design system (Tailwind, colors, spacing)
- Responsive layout
- Dark mode support

### 🚧 Future

- Chat input (connect to backend)
- Kanban drag-and-drop
- Notes input forms
- Agent graph visualization
- Integration management UI
- Cost dashboards
- WebSocket live updates

## Development Workflow

### Adding a Component

1. Create file in `UI/src/app/components/cairn/NewComponent.tsx`
2. Define types in `types.ts`
3. Import and use in `App.tsx`
4. Style with Tailwind or CSS modules
5. Document in this directory

See [Adding UI Components Guide](../05-guides/adding-components.md).

### Modifying a Component

1. Open component file
2. Make changes
3. Save — dev server hot-reloads
4. Test in browser
5. Update documentation

### Building for Production

```bash
npm run build
```

Optimizations:
- Minified JavaScript
- Code splitting
- CSS minification
- Asset optimization

## Performance

### Rendering

- React 18 concurrent rendering
- Automatic batching of state updates
- Memoization for expensive components

### Animations

- GPU-accelerated transforms (x, y, scale, opacity)
- 60fps target
- Continuous animation optimized with requestAnimationFrame

### Bundle Size

- Tree-shaking removes unused code
- Code splitting for pages
- Efficient component library

## Accessibility

All components follow WAI-ARIA standards:

- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Screen reader support
- Color contrast ratios

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Common Patterns

### State Patterns

All components follow React hooks patterns:

```typescript
const [state, setState] = useState(initialValue);
const [data, setData] = useEffect(() => { /* load data */ }, []);
```

### Event Handling

```typescript
const handleClick = (e: React.MouseEvent) => {
  // Handle event
};

<button onClick={handleClick}>Click</button>
```

### Conditional Rendering

```typescript
{condition && <Component />}
{loading ? <Spinner /> : <Content />}
```

## Best Practices

### ✅ Do

- Use TypeScript for all components
- Keep components focused (single responsibility)
- Use Tailwind for styling (not CSS-in-JS)
- Memoize expensive computations
- Add prop validation with TypeScript
- Write clear prop documentation

### ❌ Don't

- Override Tailwind with inline styles (use classes)
- Create new global styles (use Tailwind or CSS modules)
- Use `any` type (use specific types)
- Create huge monolithic components (split into smaller ones)
- Animate width/height (use transform scale instead)

## Next Steps

1. **Understand Core Principles** → [Core Principles](../07-reference/core-principles.md)
2. **Learn about specific components** → [Nucleus](nucleus.md), [Chat](chat.md), etc.
3. **Add your own components** → [Adding UI Components Guide](../05-guides/adding-components.md)
4. **View architecture** → [Architecture Overview](../02-architecture/overview.md)

## File References

- [App.tsx](../../UI/src/app/App.tsx) — Main application entry point
- [types.ts](../../UI/src/app/components/cairn/types.ts) — Shared TypeScript interfaces
- [vite.config.ts](../../UI/vite.config.ts) — Build configuration
- [tailwind.config.ts](../../UI/tailwind.config.ts) — Tailwind CSS configuration
- [Guidelines.md](../../UI/guidelines/Guidelines.md) — Development guidelines
