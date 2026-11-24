# Architecture & Engineering Standards

## 1. Package Dependency DAG

Maintain a strict acyclic dependency graph across the monorepo:

```text
packages/shared  <──  apps/server
       ▲         <──  apps/web
       └─────────<──  apps/extension
```

- `packages/shared` MUST NOT import from `apps/server`, `apps/web`, `apps/extension`, or Node-only built-ins (`node:fs`, `node:crypto`, `node:worker_threads`), because it is bundled into browser contexts (`web` and `extension`).
- `apps/web` and `apps/extension` MUST NOT import server code directly; share types and Zod validators exclusively through `@game-library/shared`.
- No circular dependencies between modules inside any package.

## 2. Server-to-Worker IPC Contract (`worker_threads`)

- `apps/server` runs the HTTP/SSE API on the main thread and delegates scraping, metadata normalization, rate-limited fetching (`p-queue` + `undici`), and cover image caching (`./data/covers/`) to a dedicated Node.js `worker_threads` worker.
- Define discriminated-union command and event message schemas in `@game-library/shared` (or internal typed server contracts validated with Zod):
  - **Main -> Worker commands:** `enqueue_sync`, `enqueue_threads`, `refresh_credentials`, `cancel_job`, `shutdown`.
  - **Worker -> Main events:** `job_started`, `job_progress`, `game_updated`, `cover_cached`, `job_completed`, `job_failed`, `worker_error`.
- Always attach `error` and `exit` listeners on the `Worker` instance, enforce clean shutdown on `SIGINT`/`SIGTERM`, and never block the Fastify event loop with HTML parsing or image I/O.

## 3. API & SSE Contract Discipline

- Validate every HTTP request body, query string, and route parameter with Zod schemas from `@game-library/shared`.
- Return a consistent JSON error envelope (`{ error: { code: string, message: string, details?: unknown } }`) with accurate HTTP status codes (`400`, `401`, `403`, `404`, `409`, `500`).
- Stream live indexing and sync updates over SSE (`/api/events`) using typed event names and JSON payloads defined in `@game-library/shared`. Always clean up client stream listeners on socket `close` and send periodic keepalive heartbeats.

## 4. Browser Extension Security Boundary

- **Background service worker only:** All `browser.cookies` access, Pairing Token storage (`browser.storage.local`), and HTTP requests to `http://127.0.0.1:<PORT>` MUST live exclusively in the extension background script.
- **Content script isolation:** Content scripts may only manipulate F95zone DOM nodes and exchange typed `runtime.sendMessage` payloads with the background worker. Content scripts must never access Pairing Tokens or cookies directly.
- **Safe DOM manipulation:** Never pass untrusted game titles, developer names, or user notes into `innerHTML`, `outerHTML`, or `insertAdjacentHTML`. Build elements with `document.createElement` and assign text via `.textContent` / `setAttribute`.

## 5. Code Quality & Verification Checklist

- Keep functions small, cohesive, and single-purpose; handle variant cases via lookup tables/maps rather than sprawling `if/else` chains.
- Write concise JSDoc comments on exported functions, classes, and non-obvious protocol invariants.
- Before considering any implementation task complete:
  1. Run workspace typechecking (`pnpm -r typecheck` or `turbo typecheck`).
  2. Run relevant unit/integration tests (`pnpm test`).
  3. Verify production builds succeed (`pnpm build`), including both Chrome and Firefox extension outputs when `apps/extension` is touched.

## React State Management Rules

- **Derive, never duplicate:** Never create `useState` for values that can be computed from existing props, Redux state, or other state during render. Never use `useEffect` solely to sync state with props or other state.
- **No boolean soup:** Do not create multiple related boolean states (e.g., `isLoading`, `isError`, `isSuccess`). Use a single status union (`'idle' | 'loading' | 'success' | 'error'`) or `useReducer`.
- **Use the right state layer:**
  - Form inputs & validation → `react-hook-form` (never `useState` per field).
  - Shared/server state → Redux Toolkit slices (do not copy Redux state into local `useState`).
  - Filters, search, tabs, pagination → URL search params (`useSearchParams`).
  - Mutable values that don't affect rendering (timers, DOM nodes, previous values) → `useRef`.
- **3-state ceiling:** If a component needs more than 3 `useState` calls, stop and refactor—either consolidate related state into `useReducer`, derive values, or extract logic into a custom hook.
- **State audit before coding:** Before adding any `useState`, verify it cannot be derived, moved to a form/URL/store, or combined with an existing state object.

// ❌ Avoid: derived state + boolean soup + effect syncing
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
const [search, setSearch] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);

useEffect(() => {
setFilteredItems(items.filter((i) => i.name.includes(search)));
}, [items, search]);

// ✅ Prefer: minimal source-of-truth state + derived values
type Status = "idle" | "loading" | "error";

const [items, setItems] = useState<Item[]>([]);
const [search, setSearch] = useState("");
const [status, setStatus] = useState<Status>("idle");

const filteredItems = items.filter((i) => i.name.includes(search));

## S.O.L.I.D Design Principles (React & TypeScript)

Apply S.O.L.I.D idiomatically for modern React (functional components, custom hooks, composition, and strict TypeScript modules—without unnecessary OOP class hierarchies or over-engineering):

- **Single Responsibility Principle (SRP):** Separate UI rendering from data fetching, business logic, and state orchestration. Extract reusable or stateful mechanics into custom hooks (`apps/web/src/hooks/`), keep pure domain/presentation transforms in utilities or services (`src/lib/`, `src/services/`), and split oversized or multi-purpose components into focused subcomponents.
- **Open/Closed Principle (OCP):** Make reusable components and presentation helpers extensible without modifying their internals. Prefer composition (`children`, slot props such as `action` or `trailingAction`, render props, and `variant` props) and declarative lookup tables/maps over growing `if/else` or `switch` chains.
- **Liskov Substitution Principle (LSP):** Custom wrappers around native HTML elements or `shadcn/ui` primitives MUST honor the base component contract—extend base prop types (`React.ComponentProps<...>` or base wrapper props), merge classes via `cn(...)`, and place default attributes before `{...props}` so callers can override attributes and substitute wrappers safely.
- **Interface Segregation Principle (ISP):** Keep component prop interfaces lean and specific. Pass only the exact primitives, callbacks, or narrow `Pick<T, ...>` slices a component requires instead of full parent objects, whole API DTOs, or raw Redux state slices.
- **Dependency Inversion Principle (DIP):** Decouple UI components from concrete implementations (Redux store internals/singletons, direct Axios calls, `window.localStorage`, `navigator.clipboard`, or raw `EventSource`). Depend on abstractions—domain custom hooks, typed service interfaces/factories, or injected callbacks/providers—so modules remain easy to test and swap.
- **Pragmatism:** Do not force all five principles onto trivial leaf components; apply them where they measurably reduce coupling or improve clarity, testability, and reuse.
