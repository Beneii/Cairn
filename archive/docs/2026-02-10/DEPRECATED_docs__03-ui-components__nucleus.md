# Nucleus Component

The Nucleus is CAIRN's central visualization — a physics-based animation that represents system state through organic motion.

## Overview

**File:** [UI/src/app/components/cairn/Nucleus.tsx](../../UI/src/app/components/cairn/Nucleus.tsx)

The Nucleus embodies CAIRN's "UI is truth" principle. The system's state MUST be visible through animation. If the Nucleus shows "tooling", the system IS executing a tool. If it shows "error", something failed.

## Component Props

```typescript
interface NucleusProps {
  state: NucleusState;
  className?: string;
  subAgents?: SubAgent[];
}

type NucleusState = "idle" | "thinking" | "tooling" | "waiting" | "error";

interface SubAgent {
  id: string;
  name: string;    // e.g., "fs_read"
  action: string;  // e.g., "reading"
  model: string;   // e.g., "gpt-4o"
}
```

## States

### Idle

**Visual:** Gentle, wide drift

**Meaning:** System is ready; no active work

**Physics Configuration:**
```typescript
baseScale: 1,
driftSpeed: 0.4,      // How fast centroid wanders
orbitSpeed: 0.5,      // Ring rotation speed
driftRange: 15,       // Max pixels from center
spread: 12,           // Ring separation
tension: 0.5,
deformation: 0.1
```

**When to use:** System is ready for input, no active tasks.

### Thinking

**Visual:** Tight cluster, fast rotation

**Meaning:** Planning, reasoning, no tool execution

**Physics Configuration:**
```typescript
baseScale: 0.85,
driftSpeed: 0.1,      // Centroid stays tight
orbitSpeed: 2.5,      // Rings spin fast
driftRange: 5,
spread: 4,            // Tight cluster
tension: 0.8,
deformation: 0.05
```

**When to use:** Agent is planning, reasoning, making decisions (no tool calls yet).

### Tooling

**Visual:** Expansion, sub-agents appear

**Meaning:** Active tool execution

**Physics Configuration:**
```typescript
baseScale: 1.1,
driftSpeed: 0.8,      // Active wandering
orbitSpeed: 1.2,
driftRange: 25,       // Large movements
spread: 30,           // Rings pull apart (budding)
tension: 0.4,
deformation: 0.3
```

**Special feature:** Sub-agents appear as smaller orbiting blobs around the nucleus.

**When to use:** Executor is running tools (APIs, file operations, code execution).

### Waiting

**Visual:** Nearly frozen

**Meaning:** Waiting for external input or response

**Physics Configuration:**
```typescript
baseScale: 1,
driftSpeed: 0.05,     // Almost frozen
orbitSpeed: 0.1,
driftRange: 2,
spread: 5,
tension: 0.9,
deformation: 0
```

**When to use:** System is blocked waiting (API response, user input, etc.).

### Error

**Visual:** Rapid jitter

**Meaning:** System error state

**Physics Configuration:**
```typescript
baseScale: 1,
driftSpeed: 5,        // Jitter
orbitSpeed: 8,        // Chaotic motion
driftRange: 10,
spread: 20,
tension: 1,
deformation: 0.5
```

**When to use:** Error occurred; system needs attention.

## Usage

### Basic Usage

```typescript
import { Nucleus } from "./components/cairn/Nucleus";
import { useState } from "react";

function App() {
  const [state, setState] = useState<NucleusState>("idle");

  return (
    <div>
      <Nucleus state={state} />

      <button onClick={() => setState("thinking")}>
        Start thinking
      </button>
    </div>
  );
}
```

### With Sub-Agents

```typescript
const [subAgents, setSubAgents] = useState<SubAgent[]>([]);

// When starting tool execution
setState("tooling");
setSubAgents([
  { id: "1", name: "web_search", action: "fetching", model: "gpt-4o" },
  { id: "2", name: "api_call", action: "calling", model: "gpt-4o" }
]);

// When done
setState("idle");
setSubAgents([]);

return <Nucleus state={state} subAgents={subAgents} />;
```

### State Transitions

```typescript
// Example workflow
setState("idle");           // Ready
// User sends input...
setState("thinking");       // Planning
// Plan complete...
setState("tooling");        // Executing tools
setSubAgents([...]);        // Show sub-agents
// Tools complete...
setState("idle");           // Back to ready
setSubAgents([]);           // Sub-agents disappear
```

## Implementation Details

### Physics Engine

The Nucleus uses a custom animation loop:

```typescript
useAnimationFrame((_, delta) => {
  // Increment time based on drift speed
  time.current += dt * smoothOrbitSpeed.get();

  const t = time.current;
  const range = smoothDriftRange.get();
  const spread = smoothSpread.get();

  // Ring 1: Outer drift
  r1x.set(Math.sin(t * 0.8) * range + Math.cos(t * 0.3) * spread);
  r1y.set(Math.cos(t * 0.7) * range + Math.sin(t * 0.4) * spread);

  // Ring 2: Different phase
  r2x.set(Math.sin(t * 0.6 + Math.PI/2) * range - Math.cos(t * 0.2) * spread);
  r2y.set(Math.cos(t * 0.8 + Math.PI/2) * range - Math.sin(t * 0.35) * spread);

  // Ring 3: Another phase
  r3x.set(Math.sin(t * 0.7 + Math.PI) * range + Math.sin(t * 0.5) * spread);
  r3y.set(Math.cos(t * 0.5 + Math.PI) * range + Math.cos(t * 0.25) * spread);
});
```

### SVG Goo Filter

Organic blob merging uses SVG filter:

```xml
<filter id="goo-rings-v2">
  <feGaussianBlur stdDeviation="10" />
  <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
</filter>
```

This creates smooth blending between rings and core.

### Smooth State Transitions

State changes animate smoothly using springs:

```typescript
const smoothScale = useSmoothState(config.baseScale, {
  stiffness: 100,
  damping: 20
});

// When state changes, spring interpolates values
// Not an instant switch
```

## Sub-Agent Visualization

When `tooling` state with sub-agents:

1. **Main nucleus** — Central blob, still animating
2. **Sub-agent blobs** — Smaller blobs orbiting the nucleus
3. **Labels** — Agent names shown (if space allows)
4. **Motion** — Sub-agents move in orbit while main nucleus moves

### Sub-Agent Data

```typescript
interface SubAgent {
  id: string;        // Unique ID
  name: string;      // Display name ("web_search", "file_read", etc.)
  action: string;    // Current action ("searching", "reading", etc.)
  model: string;     // Model used ("gpt-4o", "gpt-4-turbo", etc.)
}
```

## Performance Optimization

### GPU Acceleration

Uses GPU-accelerated properties:
- `x`, `y` — Transform translate
- `scale` — Transform scale
- `opacity` — Opacity

These are fast because they don't trigger layout recalculation.

### Animation Frame

Uses `requestAnimationFrame` for smooth 60fps motion:

```typescript
useAnimationFrame((_, delta) => {
  // Called once per frame
  // delta is milliseconds since last frame
});
```

### CSS Hints

```css
.nucleus {
  will-change: transform;  /* Hint for GPU optimization */
  backface-visibility: hidden;
}
```

## Styling

### CSS Module

[UI/src/app/components/cairn/Nucleus.module.css](../../UI/src/app/components/cairn/Nucleus.module.css)

Key styles:
- `container` — Outer wrapper with fixed size
- `svg` — SVG element with goo filter
- `rings` — Ring circles
- `core` — Central core blob
- `subAgents` — Sub-agent container

### Colors

- **Ring color:** `#1A1D21` (dark gray/black)
- **Core color:** Matches rings
- **Background:** Transparent (inherits parent)

## Common Patterns

### Cycle Through States

```typescript
useEffect(() => {
  const states: NucleusState[] = ["idle", "thinking", "tooling", "waiting", "error"];
  let currentIndex = 0;

  const interval = setInterval(() => {
    setState(states[currentIndex]);
    currentIndex = (currentIndex + 1) % states.length;
  }, 2000);  // Change every 2 seconds

  return () => clearInterval(interval);
}, []);
```

### Connect to System State

```typescript
// In real implementation, state comes from system
useEffect(() => {
  const subscription = systemState$.subscribe((state) => {
    if (state.executing_tools) setState("tooling");
    else if (state.reasoning) setState("thinking");
    else if (state.waiting) setState("waiting");
    else setState("idle");
  });

  return () => subscription.unsubscribe();
}, []);
```

### Show Error Temporarily

```typescript
const showError = () => {
  setState("error");
  setTimeout(() => setState("idle"), 3000);  // Error for 3 seconds
};
```

## Accessibility

### Current

- Visual state representation is clear
- Color alone doesn't convey meaning (motion does)
- Works in high contrast mode

### Future Improvements

- ARIA labels for state changes
- Screen reader announcements
- Manual state controls for testing

## Debugging

### Visual Testing

The [App.tsx](../../UI/src/app/App.tsx) has manual state controls:

```typescript
// In App component
<button onClick={() => setNucleusState("idle")}>Idle</button>
<button onClick={() => setNucleusState("thinking")}>Thinking</button>
<button onClick={() => setNucleusState("tooling")}>Tooling</button>
```

Use these buttons to test each state.

### Browser DevTools

In React DevTools:
1. Select Nucleus component
2. View props: `state`, `subAgents`
3. Toggle state changes
4. Watch animation in real-time

## Future Enhancements

- [ ] Sub-agent labels on hover
- [ ] Connection lines between nucleus and sub-agents
- [ ] Error state "shaking" effect
- [ ] Configurable physics parameters in preferences
- [ ] Custom colors per state
- [ ] Animation speed control
- [ ] Touch interactions
- [ ] Accessibility improvements

## Related

- [UI Components Overview](overview.md) — All components
- [Architecture Overview](../02-architecture/overview.md) — States explained
- [Core Principles](../07-reference/core-principles.md) — "UI is truth"
- [App.tsx](../../UI/src/app/App.tsx) — Usage example
