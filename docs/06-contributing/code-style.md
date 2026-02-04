# Code Style & Conventions

Development standards for CAIRN codebase.

## TypeScript

### Strict Mode

All TypeScript files use strict mode:

```typescript
// ✅ Good - explicit types
const greet = (name: string): string => {
  return `Hello, ${name}`;
};

// ❌ Bad - no `any` types
const greet = (name: any): any => {
  return `Hello, ${name}`;
};
```

### Type Definitions

Always define types explicitly:

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: "1",
  name: "Alice",
  email: "alice@example.com"
};

// ❌ Bad
const user = {
  id: "1",
  name: "Alice",
  email: "alice@example.com"
};
```

### Generics

Use generics for reusable components:

```typescript
// ✅ Good - generic, reusable
interface Result<T> {
  success: boolean;
  data: T;
  error?: Error;
}

const handleResult = <T,>(result: Result<T>): T | null => {
  return result.success ? result.data : null;
};

// ❌ Bad - hardcoded types
const handleUserResult = (result: { success: boolean; data: User }): User | null => {
  return result.success ? result.data : null;
};
```

### Enums vs Union Types

Prefer union types:

```typescript
// ✅ Good - union type
type NucleusState = "idle" | "thinking" | "tooling" | "waiting" | "error";

// Acceptable - enum (if you need namespace)
enum KanbanStatus {
  Backlog = "backlog",
  Active = "active",
  Blocked = "blocked",
  Done = "done"
}

// ❌ Bad - string magic numbers
const state = "idle";  // Easy to typo
```

---

## React Components

### Functional Components

Always use functional components with hooks:

```typescript
// ✅ Good
import { FC, useState, useEffect } from "react";

interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

const Chat: FC<ChatProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState("");

  useEffect(() => {
    // effect
  }, []);

  return <div>Chat</div>;
};

export default Chat;

// ❌ Bad - class components (deprecated pattern)
class Chat extends React.Component {
  // ...
}
```

### Prop Drilling

For deeply nested props, use Context:

```typescript
// ✅ Good - Context prevents drilling
const ThemeContext = createContext<"light" | "dark">("light");

// In parent
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>

// In deep child
const theme = useContext(ThemeContext);

// ❌ Bad - drilling through many levels
<Component1 theme={theme}>
  <Component2 theme={theme}>
    <Component3 theme={theme} />
  </Component2>
</Component1>
```

### Custom Hooks

Extract reusable logic into hooks:

```typescript
// ✅ Good - custom hook
const useNucleusState = () => {
  const [state, setState] = useState<NucleusState>("idle");

  useEffect(() => {
    // simulation logic
  }, []);

  return [state, setState];
};

// Used in component
const [nucleusState, setNucleusState] = useNucleusState();

// ❌ Bad - logic in component
const Component = () => {
  const [state, setState] = useState("idle");
  // 100+ lines of logic in component
};
```

### Component Organization

File structure for components:

```typescript
// 1. Imports
import { FC, useState, useEffect } from "react";
import { motion } from "motion/react";
import styles from "./MyComponent.module.css";

// 2. Types
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Component
const MyComponent: FC<MyComponentProps> = ({ title, onAction }) => {
  // Hooks
  const [isLoading, setIsLoading] = useState(false);

  // Effects
  useEffect(() => {
    // setup
  }, []);

  // Handlers
  const handleClick = () => {
    onAction();
  };

  // JSX
  return <div>{title}</div>;
};

// 5. Export
export default MyComponent;
```

---

## Styling

### Tailwind CSS

Use Tailwind utility classes:

```tsx
// ✅ Good - Tailwind classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 className="text-xl font-bold text-gray-900">Title</h1>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Action
  </button>
</div>

// ❌ Bad - inline styles
<div style={{ display: "flex", padding: "16px", backgroundColor: "white" }}>
  <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>Title</h1>
</div>

// ❌ Bad - arbitrary CSS
<style>{`
  .my-container {
    display: flex;
    padding: 16px;
    background-color: white;
  }
`}</style>
```

### CSS Modules

For component-specific styles:

```typescript
// MyComponent.module.css
.container {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}

.title {
  font-weight: 600;
  color: #1f2937;
}

// MyComponent.tsx
import styles from "./MyComponent.module.css";

const MyComponent: FC = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Title</h1>
    </div>
  );
};
```

### Dark Mode

Use `dark:` prefix for dark mode:

```tsx
// ✅ Good - supports both modes
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content
</div>

// ❌ Bad - light mode only
<div className="bg-white text-black">
  Content
</div>
```

---

## Naming Conventions

### Files

```
// Components (PascalCase)
Nucleus.tsx
Chat.tsx
MyNewComponent.tsx

// Hooks (camelCase with `use` prefix)
useNucleusState.ts
useScrollPosition.ts

// Utilities (camelCase)
formatDate.ts
calculateCost.ts

// Styles (same as component)
Nucleus.module.css
Chat.module.css

// Types (PascalCase or `types.ts`)
types.ts
models.ts
```

### Variables & Functions

```typescript
// ✅ Good - clear, descriptive
const isLoading = true;
const currentNucleusState: NucleusState = "thinking";
const calculateTaskCost = (task: Task): number => { ... };
const handleNucleusStateChange = (newState: NucleusState) => { ... };

// ❌ Bad - unclear
const loading = true;
const state = "thinking";  // Could be any state
const calc = (t: any): any => { ... };
const handle = () => { ... };
```

### Constants

```typescript
// ✅ Good
const DEFAULT_NUCLEUS_STATE: NucleusState = "idle";
const MAX_ANIMATION_DURATION_MS = 5000;
const API_TIMEOUT_SECONDS = 30;

// ❌ Bad
const default_state = "idle";
const max_duration = 5000;
const timeout = 30;
```

---

## Code Organization

### Module Exports

```typescript
// ✅ Good - named exports for reusability
export interface NucleusProps {
  state: NucleusState;
}

export const Nucleus: FC<NucleusProps> = ({ state }) => {
  // component
};

// Usage
import { Nucleus, NucleusProps } from "./Nucleus";

// ❌ Bad - default export only
export default Nucleus;
```

### Imports

```typescript
// ✅ Good - organized imports
import { FC, useState, useEffect } from "react";           // React hooks
import { motion } from "motion/react";                      // External libraries
import { Button } from "@/components/ui/button";           // UI components
import { useNucleusState } from "@/hooks/useNucleusState"; // Custom hooks
import { formatDate } from "@/utils/formatDate";           // Utilities
import styles from "./MyComponent.module.css";             // Styles

// ❌ Bad - disorganized
import Button from "components/button";
import { useNucleusState } from "../../hooks";
import { motion, useTransform } from "motion/react";
import { FC, useState } from "react";
```

---

## Comments & Documentation

### JSDoc for Functions

```typescript
/**
 * Calculate the cost of a task based on model and tokens.
 *
 * @param model - The AI model used (e.g., "gpt-4o")
 * @param tokens - Number of tokens used
 * @returns Cost in USD
 * @throws Error if model is not recognized
 *
 * @example
 * const cost = calculateCost("gpt-4o", 1000);
 * console.log(cost); // 0.03
 */
const calculateCost = (model: string, tokens: number): number => {
  // implementation
};
```

### Inline Comments

```typescript
// ✅ Good - explains WHY
const nucleus = useNucleusState();
// Reset to idle after 5 seconds to prevent visual distraction
useEffect(() => {
  const timeout = setTimeout(() => {
    nucleus.setState("idle");
  }, 5000);

  return () => clearTimeout(timeout);
}, [nucleus]);

// ❌ Bad - explains WHAT (code already does that)
const nucleus = useNucleusState();
// Set timeout to 5000
const timeout = setTimeout(() => {
  nucleus.setState("idle");
}, 5000);
```

### Documentation Comments

```typescript
// ✅ Good - explains purpose
interface ChatMessage {
  /** Unique identifier for this message */
  id: string;

  /** "user" for user messages, "cairn" for AI responses */
  role: "user" | "cairn";

  /** Message text content */
  text: string;

  /** ISO timestamp when message was sent */
  timestamp: string;
}
```

---

## Error Handling

### Try-Catch

```typescript
// ✅ Good - specific error handling
try {
  const data = await fetchData();
  return data;
} catch (error) {
  if (error instanceof NetworkError) {
    console.error("Network failed:", error.message);
    return null;
  }
  throw error;  // Re-throw unknown errors
}

// ❌ Bad - silent failures
try {
  const data = await fetchData();
  return data;
} catch {
  // Swallow all errors
  return null;
}
```

### Validation

```typescript
// ✅ Good - validate inputs
const setNucleusState = (newState: unknown) => {
  if (!isValidNucleusState(newState)) {
    throw new Error(`Invalid nucleus state: ${newState}`);
  }
  state.setState(newState);
};

// Type guard
const isValidNucleusState = (value: unknown): value is NucleusState => {
  return ["idle", "thinking", "tooling", "waiting", "error"].includes(value as string);
};
```

---

## Performance

### Memoization

```typescript
// ✅ Good - memo for expensive components
const NucleusDisplay = memo(({ state }: { state: NucleusState }) => {
  // Complex rendering
  return <svg>...</svg>;
});

// ✅ Good - useCallback for stable function refs
const handleStateChange = useCallback((newState: NucleusState) => {
  setState(newState);
}, []);

// ❌ Bad - recreate function every render
const handleStateChange = (newState: NucleusState) => {
  setState(newState);
};
```

### Avoid

```typescript
// ❌ Bad - creates new object every render
const config = { size: 100, color: "red" };
return <Component config={config} />;

// ✅ Good - memoize constant
const CONFIG = { size: 100, color: "red" };
return <Component config={CONFIG} />;

// Or use useMemo
const config = useMemo(() => ({ size: 100, color: "red" }), []);
```

---

## Testing

(See [Testing Guide](../05-guides/testing.md) for full test standards)

### Unit Test Example

```typescript
describe("calculateCost", () => {
  it("calculates cost correctly for known models", () => {
    expect(calculateCost("gpt-4o", 1000)).toBe(0.03);
    expect(calculateCost("gpt-4-turbo", 1000)).toBe(0.01);
  });

  it("throws error for unknown model", () => {
    expect(() => calculateCost("unknown", 1000)).toThrow();
  });
});
```

---

## Git Commits

See [Git Workflow](git-workflow.md) for commit message standards.

---

## Linting

### Run Linter

```bash
npm run lint
```

Checks:
- TypeScript errors
- ESLint rules
- Unused imports
- Code style

### Fix Issues

```bash
npm run lint -- --fix
```

Auto-fixes style issues.

---

## Summary Checklist

Before committing code:

- [ ] TypeScript strict mode (no `any`)
- [ ] Functional components with hooks
- [ ] Tailwind CSS for styling
- [ ] Meaningful variable names
- [ ] JSDoc for complex functions
- [ ] Error handling (try-catch, validation)
- [ ] Tests pass
- [ ] Linter passes
- [ ] No console errors/warnings

---

See [Git Workflow](git-workflow.md) for commit process and [Contributing Guidelines](../06-contributing/code-style.md) for PR requirements.
