# Push Notification Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@idevconn/push-notifications` — a Nest 11 + React 19 dual-export package for sending push (Web Push/VAPID, FCM, APNs), managing subscriptions, and tracking notification history.

**Architecture:** Provider-agnostic `PushService` dispatches to lazy-loaded Web Push / FCM / APNs providers. Storage is interface-only (`SubscriptionStore`, `NotificationLogStore`) with an optional TypeORM adapter. React hooks cover browser-side permission + subscription (VAPID native + FCM web token). tsup builds four entry points (`.`, `./server`, `./react`, `./typeorm`) as dual ESM/CJS.

**Tech Stack:** TypeScript 5, tsup, vitest, Nest 11 (`@nestjs/common` ^11, `@nestjs/core` ^11), React 19, `web-push`, `firebase-admin`, `@parse/node-apn`, `typeorm` + `@nestjs/typeorm` — all optional peer deps.

**Spec:** `docs/superpowers/specs/2026-09-07-push-notification-design.md`

## Global Constraints

- Nest peer dep floor: `>=11.0.0` (`@nestjs/common`, `@nestjs/core`).
- React peer dep floor: `>=19.0.0`.
- Provider SDKs (`web-push`, `firebase-admin`, `@parse/node-apn`, `typeorm`, `@nestjs/typeorm`, `firebase`) are **optional** peer deps, lazy-`require`d/dynamically imported — installing the package must not force any of them.
- Package is `type: module`, dual ESM/CJS output via tsup, matching `@idevconn/ai-usage`'s exports-map pattern.
- No default in-memory store implementation — `SubscriptionStore`/`NotificationLogStore` have no fallback; consumer must wire one explicitly.
- Per-target send failures never throw — always captured in `SendResult.error`. Config/init errors throw synchronously at module bootstrap.
- Dead-token codes: Web Push HTTP `410`/`404`; FCM `messaging/registration-token-not-registered` / `InvalidRegistration`; APNs `BadDeviceToken` / `Unregistered`.

---

## File Structure

```
package.json, tsconfig.json, tsup.config.ts, eslint.config.js, vitest.config.ts, vitest.setup.ts, .gitignore
src/
  index.ts                                  shared types + interfaces, DI tokens
  server/
    index.ts                                barrel (./server export)
    push-notification.module.ts
    push.service.ts
    notification.controller.ts
    notification-webhook.controller.ts
    interfaces/
      subscription-store.interface.ts
      notification-log-store.interface.ts
    providers/
      webpush.provider.ts
      fcm.provider.ts
      apns.provider.ts
    __tests__/
      push.service.spec.ts
      notification.controller.spec.ts
      notification-webhook.controller.spec.ts
      webpush.provider.spec.ts
      fcm.provider.spec.ts
      apns.provider.spec.ts
  react/
    index.ts                                barrel (./react export)
    use-push-permission.ts
    use-push-subscription.ts
    use-push-subscription-fcm.ts
    __tests__/
      use-push-permission.test.tsx
      use-push-subscription.test.tsx
      use-push-subscription-fcm.test.tsx
  typeorm/
    index.ts                                barrel (./typeorm export)
    push-subscription.entity.ts
    notification.entity.ts
    typeorm-subscription-store.ts
    typeorm-notification-log-store.ts
    __tests__/
      typeorm-subscription-store.spec.ts
      typeorm-notification-log-store.spec.ts
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.gitignore`
- Create: `src/index.ts` (placeholder export, replaced in Task 2)

**Interfaces:**
- Produces: working `npm run build`, `npm test`, `npm run typecheck`, `npm run lint` scripts for every later task to rely on.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@idevconn/push-notifications",
  "version": "0.1.0",
  "description": "Host-agnostic push notifications: Web Push/VAPID, FCM, APNs sending, a NestJS module, and React 19 hooks.",
  "license": "Apache-2.0",
  "author": "iDEVconn",
  "repository": { "type": "git", "url": "git+https://github.com/iDEVconn/push-notifications.git" },
  "bugs": { "url": "https://github.com/iDEVconn/push-notifications/issues" },
  "homepage": "https://github.com/iDEVconn/push-notifications#readme",
  "keywords": ["push", "notifications", "webpush", "vapid", "fcm", "apns", "nestjs", "react"],
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./server": {
      "import": { "types": "./dist/server.d.ts", "default": "./dist/server.js" },
      "require": { "types": "./dist/server.d.cts", "default": "./dist/server.cjs" }
    },
    "./react": {
      "import": { "types": "./dist/react.d.ts", "default": "./dist/react.js" },
      "require": { "types": "./dist/react.d.cts", "default": "./dist/react.cjs" }
    },
    "./typeorm": {
      "import": { "types": "./dist/typeorm.d.ts", "default": "./dist/typeorm.js" },
      "require": { "types": "./dist/typeorm.d.cts", "default": "./dist/typeorm.cjs" }
    }
  },
  "typesVersions": {
    "*": {
      "server": ["./dist/server.d.ts"],
      "react": ["./dist/react.d.ts"],
      "typeorm": ["./dist/typeorm.d.ts"]
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run typecheck && npm run test && npm run build"
  },
  "peerDependencies": {
    "@nestjs/common": ">=11.0.0",
    "@nestjs/core": ">=11.0.0",
    "react": ">=19.0.0",
    "web-push": ">=3.6.0",
    "firebase-admin": ">=12.0.0",
    "@parse/node-apn": ">=6.0.0",
    "typeorm": ">=0.3.0",
    "@nestjs/typeorm": ">=10.0.0",
    "firebase": ">=10.0.0"
  },
  "peerDependenciesMeta": {
    "@nestjs/common": { "optional": true },
    "@nestjs/core": { "optional": true },
    "react": { "optional": true },
    "web-push": { "optional": true },
    "firebase-admin": { "optional": true },
    "@parse/node-apn": { "optional": true },
    "typeorm": { "optional": true },
    "@nestjs/typeorm": { "optional": true },
    "firebase": { "optional": true }
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@nestjs/typeorm": "^11.0.3",
    "@parse/node-apn": "^6.0.1",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/web-push": "^3.6.4",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "firebase": "^10.14.0",
    "firebase-admin": "^12.6.0",
    "jsdom": "^25.0.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "sqlite3": "^5.1.7",
    "tsup": "^8.3.0",
    "typeorm": "^0.3.20",
    "typescript": "^5.5.0",
    "vitest": "^4.1.7",
    "web-push": "^3.6.7"
  },
  "publishConfig": { "access": "public" }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Write `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server/index.ts',
    react: 'src/react/index.ts',
    typeorm: 'src/typeorm/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/typeorm',
    'react',
    'web-push',
    'firebase-admin',
    '@parse/node-apn',
    'typeorm',
    'firebase',
    'firebase/messaging',
  ],
});
```

- [ ] **Step 4: Write `eslint.config.js`**

`tsconfig.json`'s `include: ["src"]` (Step 2) covers test files too — `dist` output is controlled by tsup's own entry-point-reachability bundling (Task 14), not by this tsconfig's file list, so including tests here has no build-leakage risk. `eslint.config.js`'s `files` glob below also matches test files for type-aware linting, so it can point straight at the same `tsconfig.json`.

```js
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 6: Write `vitest.setup.ts`**

```ts
import 'reflect-metadata';
import '@testing-library/jest-dom';
```

**Note:** `reflect-metadata` is imported here (not just left as an ambient devDependency) because TypeORM's `@Column()` decorator — used without an explicit `type` — infers column types via `Reflect.getMetadata`, which does nothing until this polyfill has run. Task 10's tests would fail without it if this weren't imported before entity classes load.

- [ ] **Step 7: Write `.gitignore`**

```
node_modules
dist
*.log
.DS_Store
.worktrees/
```

- [ ] **Step 8: Write placeholder `src/index.ts`**

```ts
export const VERSION = '0.1.0';
```

- [ ] **Step 9: Install deps and verify build**

Run: `npm install`
Expected: installs clean, no peer dep errors (all optional).

Run: `npm run build`
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` created. (server/react/typeorm entries will fail until Tasks 6/11/14/10 create their `index.ts` barrels — for now, temporarily comment out the other three entries in `tsup.config.ts`, or create empty placeholder barrels `src/server/index.ts`, `src/react/index.ts`, `src/typeorm/index.ts` each containing `export const __placeholder = true;` so the build succeeds end-to-end. Use the placeholder-barrel approach — it keeps `tsup.config.ts` in its final form from the start.)

Run: `npm test`
Expected: "No test files found" (0 tests) — acceptable at this stage.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts eslint.config.js vitest.config.ts vitest.setup.ts .gitignore src/index.ts src/server/index.ts src/react/index.ts src/typeorm/index.ts package-lock.json
git commit -m "chore: scaffold package tooling"
```

---

### Task 2: Shared types and interfaces

**Files:**
- Modify: `src/index.ts`
- Test: `src/__tests__/index.spec.ts`

**Interfaces:**
- Produces: `PushPayload`, `PushTarget`, `SendResult`, `NotificationRecord`, `SubscriptionStore`, `NotificationLogStore`, DI tokens `SUBSCRIPTION_STORE`, `NOTIFICATION_LOG_STORE` — every later task imports these from `../index` (or `../../index` from `__tests__`).

- [ ] **Step 1: Write the failing test**

`src/__tests__/index.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SUBSCRIPTION_STORE,
  NOTIFICATION_LOG_STORE,
  NOTIFICATION_AUTHORIZER,
  NOTIFICATION_WEBHOOK_VERIFIER,
} from '../index';

const TOKENS = [SUBSCRIPTION_STORE, NOTIFICATION_LOG_STORE, NOTIFICATION_AUTHORIZER, NOTIFICATION_WEBHOOK_VERIFIER];

describe('DI tokens', () => {
  it('are unique symbols', () => {
    for (const token of TOKENS) {
      expect(typeof token).toBe('symbol');
    }
    expect(new Set(TOKENS).size).toBe(TOKENS.length);
  });
});
```

**Note:** `NOTIFICATION_WEBHOOK_VERIFIER` was added retroactively during Task 9 (see that task's section) for the same reason `NOTIFICATION_AUTHORIZER` was added during Task 8 — a required, injectable security hook, added here for consistency with the other shared tokens.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/index.spec.ts`
Expected: FAIL — `SUBSCRIPTION_STORE` not exported.

- [ ] **Step 3: Write implementation**

`src/index.ts`:

```ts
export const SUBSCRIPTION_STORE = Symbol('SUBSCRIPTION_STORE');
export const NOTIFICATION_LOG_STORE = Symbol('NOTIFICATION_LOG_STORE');
export const NOTIFICATION_AUTHORIZER = Symbol('NOTIFICATION_AUTHORIZER');
export const NOTIFICATION_WEBHOOK_VERIFIER = Symbol('NOTIFICATION_WEBHOOK_VERIFIER');

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type PushTarget =
  | { type: 'webpush'; userId: string; subscription: WebPushSubscriptionJSON }
  | { type: 'fcm'; userId: string; token: string }
  | { type: 'apns'; userId: string; token: string };

export interface SendError {
  code: string;
  message: string;
  isDeadToken: boolean;
}

export interface SendResult {
  target: PushTarget;
  success: boolean;
  error?: SendError;
}

export interface SubscriptionStore {
  save(userId: string, target: PushTarget): Promise<void>;
  findByUserId(userId: string): Promise<PushTarget[]>;
  delete(userId: string, target: PushTarget): Promise<void>;
  findAll(): Promise<PushTarget[]>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationLogStore {
  save(record: { userId: string; title: string; body: string }): Promise<NotificationRecord>;
  findUnreadByUserId(userId: string): Promise<NotificationRecord[]>;
  markAsRead(id: string): Promise<void>;
}

/**
 * Authorizes access to notification data. `request` is the raw HTTP
 * request object (typed `unknown` to stay HTTP-adapter-agnostic — cast it
 * to your framework's request type, e.g. Express's `Request`, to read
 * whatever identity your auth middleware attached). This package has no
 * opinion on auth strategy; providing a `NOTIFICATION_AUTHORIZER` is
 * required to use `NotificationController` — there is no default
 * implementation, so a consumer cannot wire the controller without
 * deciding how access is checked.
 */
export interface NotificationAuthorizer {
  authorizeUserAccess(request: unknown, userId: string): boolean | Promise<boolean>;
  authorizeNotificationAccess(request: unknown, notificationId: string): boolean | Promise<boolean>;
}

/**
 * Verifies an inbound delivery-report webhook actually came from the
 * configured aggregator (OneSignal, Airship, etc.) — e.g. checking an
 * HMAC signature header against a shared secret. `request` is typed
 * `unknown` for the same host-agnostic reason as `NotificationAuthorizer`.
 * Required to use `NotificationWebhookController` — without it, anyone
 * who can reach the endpoint could fabricate a "failed" delivery report
 * and prune an arbitrary user's push subscription.
 */
export interface NotificationWebhookVerifier {
  verify(request: unknown): boolean | Promise<boolean>;
}
```

**Added after Task 8:** `NOTIFICATION_AUTHORIZER`/`NotificationAuthorizer` were not part of this task's original scope — they were added retroactively (see Task 8's section) after a security review found `NotificationController` had no ownership check on its route params. A required, injectable authorizer (same "consumer supplies the implementation, fails closed without one" idiom as `SubscriptionStore`) was the fix, so it lives here alongside the other shared interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/index.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/__tests__/index.spec.ts
git commit -m "feat: add shared push notification types and DI tokens"
```

---

### Task 3: Web Push provider

**Files:**
- Create: `src/server/providers/webpush.provider.ts`
- Test: `src/server/__tests__/webpush.provider.spec.ts`

**Interfaces:**
- Consumes: `PushPayload`, `SendResult`, `PushTarget` (`type: 'webpush'`) from `../../index`.
- Produces: `sendWebPush(target, payload, config): Promise<SendResult>` and `WebPushConfig` type — consumed by `PushService` in Task 6.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/webpush.provider.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const sendNotificationMock = vi.fn();
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: sendNotificationMock,
  },
}));

import { sendWebPush } from '../providers/webpush.provider';
import type { PushTarget } from '../../index';

const target: PushTarget = {
  type: 'webpush',
  userId: 'user-1',
  subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
};

const config = { vapidPublicKey: 'pub', vapidPrivateKey: 'priv', subject: 'mailto:a@b.com' };

describe('sendWebPush', () => {
  it('returns success on 201/200 response', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
    expect(result.target).toBe(target);
  });

  it('flags dead token on 410 Gone', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410, body: 'gone' }));
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('410');
  });

  it('flags dead token on 404 Not Found', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404, body: 'not found' }));
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error on other failures', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('Server Error'), { statusCode: 500, body: 'server error' }));
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(false);
    expect(result.error?.code).toBe('500');
  });

  it('rejects non-https endpoints without attempting to send', async () => {
    sendNotificationMock.mockReset();
    const httpTarget: PushTarget = {
      type: 'webpush',
      userId: 'user-1',
      subscription: { endpoint: 'http://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
    };
    const result = await sendWebPush(httpTarget, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid-endpoint');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('rejects endpoints pointing at private or loopback hosts', async () => {
    sendNotificationMock.mockReset();
    const privateTarget: PushTarget = {
      type: 'webpush',
      userId: 'user-1',
      subscription: { endpoint: 'https://127.0.0.1/abc', keys: { p256dh: 'p', auth: 'a' } },
    };
    const result = await sendWebPush(privateTarget, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid-endpoint');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
```

**Note on rejection mocks and reset timing:** two non-obvious fixes here versus a naive test:
1. `sendNotificationMock.mockReset()` is called as the FIRST LINE of each `it`, not in a `beforeEach`. On this project's `vitest@4.1.11`, calling `.mockReset()`/`.mockClear()` inside a `beforeEach` hook corrupts that mock's rejection handling for the test that follows — a `mockRejectedValue()` set later in the same test then gets misreported as a test failure even though it's caught in `try/catch` and every assertion passes. Verified by isolated repro: identical test passes when the reset is inline, fails when the exact same reset is moved into `beforeEach`. This is a hook-timing defect in this vitest version, not a matter of Error-vs-plain-object rejection values.
2. Every `mockRejectedValue` uses `Object.assign(new Error(...), {...})` rather than a plain object literal. Not required to dodge the bug above (that's fixed by point 1 alone) — kept because it's the more faithful mock: the real `web-push` package rejects with `WebPushError`, an `Error` subclass, not a plain object.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/webpush.provider.spec.ts`
Expected: FAIL — module `../providers/webpush.provider` not found.

- [ ] **Step 3: Write implementation**

`src/server/providers/webpush.provider.ts`:

```ts
import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
}

const DEAD_TOKEN_STATUS_CODES = new Set([404, 410]);

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
];

function isDisallowedEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return true;
  }
  if (url.protocol !== 'https:') return true;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  return PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

export async function sendWebPush(
  target: PushTarget & { type: 'webpush' },
  payload: PushPayload,
  config: WebPushConfig,
): Promise<SendResult> {
  // target.subscription.endpoint is client-submitted and stored by the consumer app —
  // reject anything that isn't an https push-service URL before handing it to web-push,
  // so this provider can't be used as an SSRF proxy against internal/loopback hosts.
  if (isDisallowedEndpoint(target.subscription.endpoint)) {
    return {
      target,
      success: false,
      error: { code: 'invalid-endpoint', message: 'Web Push endpoint is not an allowed https destination', isDeadToken: false },
    };
  }

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(config.subject, config.vapidPublicKey, config.vapidPrivateKey);

  try {
    await webpush.sendNotification(target.subscription, JSON.stringify(payload));
    return { target, success: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
    return {
      target,
      success: false,
      error: {
        code: String(statusCode),
        // Don't propagate the raw upstream response body — it may echo back
        // content from a host we didn't intend to contact.
        message: 'Web Push send failed',
        isDeadToken: DEAD_TOKEN_STATUS_CODES.has(statusCode),
      },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/webpush.provider.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/webpush.provider.ts src/server/__tests__/webpush.provider.spec.ts
git commit -m "feat: add Web Push provider with dead-token detection"
```

---

### Task 4: FCM provider

**Files:**
- Create: `src/server/providers/fcm.provider.ts`
- Test: `src/server/__tests__/fcm.provider.spec.ts`

**Interfaces:**
- Consumes: `PushPayload`, `SendResult`, `PushTarget` (`type: 'fcm'`) from `../../index`.
- Produces: `sendFcm(target, payload, config): Promise<SendResult>`, `FcmConfig` — consumed by `PushService` in Task 6.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/fcm.provider.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const sendMock = vi.fn();
const getMessagingMock = vi.fn(() => ({ send: sendMock }));
const initializeAppMock = vi.fn(() => ({}));
const credentialCertMock = vi.fn();

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: initializeAppMock,
    credential: { cert: credentialCertMock },
    messaging: getMessagingMock,
  },
}));

import { sendFcm } from '../providers/fcm.provider';
import type { PushTarget } from '../../index';

const target: PushTarget = { type: 'fcm', userId: 'user-1', token: 'device-token-abc' };
const config = { serviceAccount: { projectId: 'p' } };

describe('sendFcm', () => {
  it('returns success when send resolves', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockResolvedValue('message-id-123');
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
  });

  it('flags dead token on registration-token-not-registered', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockRejectedValue(
      Object.assign(new Error('not registered'), { code: 'messaging/registration-token-not-registered' }),
    );
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('messaging/registration-token-not-registered');
  });

  it('flags dead token on InvalidRegistration', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockRejectedValue(Object.assign(new Error('invalid'), { code: 'InvalidRegistration' }));
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error for other codes', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockRejectedValue(Object.assign(new Error('boom'), { code: 'messaging/internal-error', message: 'boom' }));
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(false);
  });
});
```

**Note on rejection mocks and reset timing:** same two fixes as Task 3's provider test. (1) `.mockReset()`/`.mockClear()` are called as the first lines of each `it`, never in a `beforeEach` — on this project's `vitest@4.1.11`, resetting a mock inside `beforeEach` corrupts that mock's rejection handling for the test that follows, misreporting a caught, assertion-passing `mockRejectedValue` as a failure (verified by isolated repro, unrelated to vi.mock/dynamic-import/Error-vs-plain-object). (2) rejections use `Object.assign(new Error(...), {...})` because real `firebase-admin` messaging errors are `Error` instances, not plain objects.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/fcm.provider.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/server/providers/fcm.provider.ts`:

```ts
import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface FcmConfig {
  serviceAccount: object;
}

const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'InvalidRegistration']);

let cachedApp: unknown;

async function getMessaging(config: FcmConfig) {
  const admin = (await import('firebase-admin')).default;
  if (!cachedApp) {
    cachedApp = admin.apps.length
      ? admin.apps[0]
      : admin.initializeApp({ credential: admin.credential.cert(config.serviceAccount as never) });
  }
  return admin.messaging();
}

export async function sendFcm(
  target: PushTarget & { type: 'fcm' },
  payload: PushPayload,
  config: FcmConfig,
): Promise<SendResult> {
  try {
    const messaging = await getMessaging(config);
    await messaging.send({
      token: target.token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data as Record<string, string> | undefined,
    });
    return { target, success: true };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    const message = (err as { message?: string }).message ?? 'FCM send failed';
    return {
      target,
      success: false,
      error: { code, message, isDeadToken: DEAD_TOKEN_CODES.has(code) },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/fcm.provider.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/fcm.provider.ts src/server/__tests__/fcm.provider.spec.ts
git commit -m "feat: add FCM provider with dead-token detection"
```

---

### Task 5: APNs provider

**Files:**
- Create: `src/server/providers/apns.provider.ts`
- Test: `src/server/__tests__/apns.provider.spec.ts`

**Interfaces:**
- Consumes: `PushPayload`, `SendResult`, `PushTarget` (`type: 'apns'`) from `../../index`.
- Produces: `sendApns(target, payload, config): Promise<SendResult>`, `ApnsConfig` — consumed by `PushService` in Task 6.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/apns.provider.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();

class MockProvider {
  send = sendMock;
}
class MockNotification {
  alert = '';
  topic = '';
  payload: Record<string, unknown> = {};
}

vi.mock('@parse/node-apn', () => ({
  default: { Provider: MockProvider, Notification: MockNotification },
}));

import { sendApns } from '../providers/apns.provider';
import type { PushTarget } from '../../index';

const target: PushTarget = { type: 'apns', userId: 'user-1', token: 'device-token-abc' };
const config = { key: 'key-contents', keyId: 'KEYID', teamId: 'TEAMID', bundleId: 'com.example.app' };

beforeEach(() => sendMock.mockReset());

describe('sendApns', () => {
  it('returns success when no failures reported', async () => {
    sendMock.mockResolvedValue({ sent: [{ device: target.token }], failed: [] });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
  });

  it('flags dead token on BadDeviceToken', async () => {
    sendMock.mockResolvedValue({
      sent: [],
      failed: [{ device: target.token, response: { reason: 'BadDeviceToken' } }],
    });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('BadDeviceToken');
  });

  it('flags dead token on Unregistered', async () => {
    sendMock.mockResolvedValue({
      sent: [],
      failed: [{ device: target.token, response: { reason: 'Unregistered' } }],
    });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error for other reasons', async () => {
    sendMock.mockResolvedValue({
      sent: [],
      failed: [{ device: target.token, response: { reason: 'PayloadTooLarge' } }],
    });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/apns.provider.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/server/providers/apns.provider.ts`:

```ts
import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface ApnsConfig {
  key: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  production?: boolean;
}

const DEAD_TOKEN_REASONS = new Set(['BadDeviceToken', 'Unregistered']);

let cachedProvider: { send: (n: unknown, t: string) => Promise<{ failed: { response?: { reason?: string } }[] }> } | undefined;

async function getProvider(config: ApnsConfig) {
  const apn = (await import('@parse/node-apn')).default;
  if (!cachedProvider) {
    cachedProvider = new apn.Provider({
      token: { key: config.key, keyId: config.keyId, teamId: config.teamId },
      production: config.production ?? false,
    }) as never;
  }
  return { apn, provider: cachedProvider! };
}

export async function sendApns(
  target: PushTarget & { type: 'apns' },
  payload: PushPayload,
  config: ApnsConfig,
): Promise<SendResult> {
  try {
    const { apn, provider } = await getProvider(config);

    const notification = new apn.Notification();
    notification.alert = { title: payload.title, body: payload.body };
    notification.topic = config.bundleId;
    notification.payload = payload.data ?? {};

    const response = await provider.send(notification, target.token);
    const failure = response.failed[0];

    if (!failure) {
      return { target, success: true };
    }

    const reason = failure.response?.reason ?? 'Unknown';
    return {
      target,
      success: false,
      error: { code: reason, message: `APNs send failed: ${reason}`, isDeadToken: DEAD_TOKEN_REASONS.has(reason) },
    };
  } catch (err) {
    return {
      target,
      success: false,
      error: { code: 'apns-error', message: (err as Error).message ?? 'APNs send failed', isDeadToken: false },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/apns.provider.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/apns.provider.ts src/server/__tests__/apns.provider.spec.ts
git commit -m "feat: add APNs provider with dead-token detection"
```

---

### Task 6: SubscriptionStore/NotificationLogStore interface files + PushService

**Files:**
- Create: `src/server/interfaces/subscription-store.interface.ts`
- Create: `src/server/interfaces/notification-log-store.interface.ts`
- Create: `src/server/push.service.ts`
- Test: `src/server/__tests__/push.service.spec.ts`

**Interfaces:**
- Consumes: `sendWebPush`/`WebPushConfig` (Task 3), `sendFcm`/`FcmConfig` (Task 4), `sendApns`/`ApnsConfig` (Task 5), `SubscriptionStore`, `PushTarget`, `PushPayload`, `SendResult`, `SUBSCRIPTION_STORE` from `../index`.
- Produces: `PushService.send(target, payload)`, `PushService.sendBulk(targets, payload)`, `PushServiceConfig` type, `ProviderNotConfiguredError` class — consumed by `PushNotificationModule` (Task 7).

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/push.service.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendWebPushMock = vi.fn();
const sendFcmMock = vi.fn();
const sendApnsMock = vi.fn();

vi.mock('../providers/webpush.provider', () => ({ sendWebPush: sendWebPushMock }));
vi.mock('../providers/fcm.provider', () => ({ sendFcm: sendFcmMock }));
vi.mock('../providers/apns.provider', () => ({ sendApns: sendApnsMock }));

import { PushService, ProviderNotConfiguredError } from '../push.service';
import type { PushTarget, SubscriptionStore } from '../../index';

const webpushTarget: PushTarget = {
  type: 'webpush',
  userId: 'user-1',
  subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
};
const fcmTarget: PushTarget = { type: 'fcm', userId: 'user-1', token: 'tok-1' };

function makeStore(): SubscriptionStore {
  return {
    save: vi.fn(),
    findByUserId: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
  };
}

beforeEach(() => {
  sendWebPushMock.mockReset();
  sendFcmMock.mockReset();
  sendApnsMock.mockReset();
});

describe('PushService', () => {
  it('dispatches webpush target to sendWebPush', async () => {
    sendWebPushMock.mockResolvedValue({ target: webpushTarget, success: true });
    const store = makeStore();
    const service = new PushService({ webpush: { vapidPublicKey: 'a', vapidPrivateKey: 'b', subject: 'c' } }, store);

    const result = await service.send(webpushTarget, { title: 't', body: 'b' });

    expect(sendWebPushMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it('throws ProviderNotConfiguredError when provider config missing', async () => {
    const store = makeStore();
    const service = new PushService({}, store);

    await expect(service.send(fcmTarget, { title: 't', body: 'b' })).rejects.toThrow(ProviderNotConfiguredError);
  });

  it('auto-prunes dead tokens when autoPruneOnFailure is true (default)', async () => {
    sendFcmMock.mockResolvedValue({
      target: fcmTarget,
      success: false,
      error: { code: 'InvalidRegistration', message: 'dead', isDeadToken: true },
    });
    const store = makeStore();
    const service = new PushService({ fcm: { serviceAccount: {} } }, store);

    await service.send(fcmTarget, { title: 't', body: 'b' });

    expect(store.delete).toHaveBeenCalledWith('user-1', fcmTarget);
  });

  it('does not prune when autoPruneOnFailure is false', async () => {
    sendFcmMock.mockResolvedValue({
      target: fcmTarget,
      success: false,
      error: { code: 'InvalidRegistration', message: 'dead', isDeadToken: true },
    });
    const store = makeStore();
    const service = new PushService({ fcm: { serviceAccount: {} }, autoPruneOnFailure: false }, store);

    await service.send(fcmTarget, { title: 't', body: 'b' });

    expect(store.delete).not.toHaveBeenCalled();
  });

  it('sendBulk isolates per-target failures', async () => {
    sendFcmMock
      .mockResolvedValueOnce({ target: fcmTarget, success: true })
      .mockRejectedValueOnce(new Error('network down'));
    const secondTarget: PushTarget = { type: 'fcm', userId: 'user-2', token: 'tok-2' };
    const store = makeStore();
    const service = new PushService({ fcm: { serviceAccount: {} } }, store);

    const results = await service.sendBulk([fcmTarget, secondTarget], { title: 't', body: 'b' });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/push.service.spec.ts`
Expected: FAIL — module `../push.service` not found.

- [ ] **Step 3: Write the interface files**

`src/server/interfaces/subscription-store.interface.ts`:

```ts
export type { SubscriptionStore } from '../../index';
export { SUBSCRIPTION_STORE } from '../../index';
```

`src/server/interfaces/notification-log-store.interface.ts`:

```ts
export type { NotificationLogStore, NotificationRecord } from '../../index';
export { NOTIFICATION_LOG_STORE } from '../../index';
```

- [ ] **Step 4: Write `push.service.ts`**

```ts
import type { PushPayload, PushTarget, SendResult, SubscriptionStore } from '../index';
import { sendWebPush, type WebPushConfig } from './providers/webpush.provider';
import { sendFcm, type FcmConfig } from './providers/fcm.provider';
import { sendApns, type ApnsConfig } from './providers/apns.provider';

export interface PushServiceConfig {
  webpush?: WebPushConfig;
  fcm?: FcmConfig;
  apns?: ApnsConfig;
  autoPruneOnFailure?: boolean;
}

export class ProviderNotConfiguredError extends Error {
  constructor(type: string) {
    super(`Push provider "${type}" is not configured`);
  }
}

export class PushService {
  constructor(
    private readonly config: PushServiceConfig,
    private readonly store: SubscriptionStore,
  ) {}

  async send(target: PushTarget, payload: PushPayload): Promise<SendResult> {
    const result = await this.dispatch(target, payload);

    if (!result.success && result.error?.isDeadToken && (this.config.autoPruneOnFailure ?? true)) {
      await this.store.delete(target.userId, target);
    }

    return result;
  }

  async sendBulk(targets: PushTarget[], payload: PushPayload): Promise<SendResult[]> {
    return Promise.all(
      targets.map(async (target) => {
        try {
          return await this.send(target, payload);
        } catch (err) {
          return {
            target,
            success: false,
            error: { code: 'send-error', message: (err as Error).message, isDeadToken: false },
          };
        }
      }),
    );
  }

  private dispatch(target: PushTarget, payload: PushPayload): Promise<SendResult> {
    switch (target.type) {
      case 'webpush':
        if (!this.config.webpush) throw new ProviderNotConfiguredError('webpush');
        return sendWebPush(target, payload, this.config.webpush);
      case 'fcm':
        if (!this.config.fcm) throw new ProviderNotConfiguredError('fcm');
        return sendFcm(target, payload, this.config.fcm);
      case 'apns':
        if (!this.config.apns) throw new ProviderNotConfiguredError('apns');
        return sendApns(target, payload, this.config.apns);
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/push.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/interfaces src/server/push.service.ts src/server/__tests__/push.service.spec.ts
git commit -m "feat: add PushService with provider dispatch and auto-prune"
```

---

### Task 7: PushNotificationModule

**Files:**
- Create: `src/server/push-notification.module.ts`
- Test: `src/server/__tests__/push-notification.module.spec.ts`

**Interfaces:**
- Consumes: `PushService`, `PushServiceConfig` (Task 6), `SUBSCRIPTION_STORE` (Task 2).
- Produces: `PushNotificationModule.forRoot(config)`, `.forRootAsync({ useFactory, inject })`, `PushNotificationModuleConfig` — consumed by consumer apps and by Task 14's `server/index.ts` barrel.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/push-notification.module.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PushNotificationModule, PushNotificationModuleConfig } from '../push-notification.module';
import { PushService } from '../push.service';
import { SUBSCRIPTION_STORE } from '../../index';

const dummyStore = { save: async () => {}, findByUserId: async () => [], delete: async () => {}, findAll: async () => [] };

const EXTRA_CONFIG = Symbol('EXTRA_CONFIG');

@Global()
@Module({
  providers: [{ provide: EXTRA_CONFIG, useValue: { serviceAccount: { projectId: 'injected' } } }],
  exports: [EXTRA_CONFIG],
})
class ExtraConfigModule {}

describe('PushNotificationModule', () => {
  it('forRoot registers PushService with given config', async () => {
    const config: PushNotificationModuleConfig = {
      webpush: { vapidPublicKey: 'a', vapidPrivateKey: 'b', subject: 'c' },
      subscriptionStore: dummyStore,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [PushNotificationModule.forRoot(config)],
    }).compile();

    expect(moduleRef.get(PushService)).toBeInstanceOf(PushService);
    expect(moduleRef.get(SUBSCRIPTION_STORE)).toBe(dummyStore);
  });

  it('forRootAsync resolves config via factory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PushNotificationModule.forRootAsync({
          useFactory: () => ({ fcm: { serviceAccount: {} }, subscriptionStore: dummyStore }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(PushService)).toBeInstanceOf(PushService);
  });

  it('forRootAsync injects a real dependency into the factory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ExtraConfigModule,
        PushNotificationModule.forRootAsync({
          useFactory: (extra: { serviceAccount: object }) => ({ fcm: extra, subscriptionStore: dummyStore }),
          inject: [EXTRA_CONFIG],
        }),
      ],
    }).compile();

    expect(moduleRef.get(PushService)).toBeInstanceOf(PushService);
  });

  it('throws at bootstrap when webpush config is missing required fields', async () => {
    const badConfig = { webpush: { vapidPublicKey: 'a' } as never, subscriptionStore: dummyStore };
    await expect(
      Test.createTestingModule({ imports: [PushNotificationModule.forRoot(badConfig)] }).compile(),
    ).rejects.toThrow(/webpush/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/push-notification.module.spec.ts`
Expected: FAIL — module `../push-notification.module` not found.

- [ ] **Step 3: Write implementation**

`src/server/push-notification.module.ts`:

```ts
import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { PushService, PushServiceConfig } from './push.service';
import { SUBSCRIPTION_STORE, SubscriptionStore } from '../index';

export interface PushNotificationModuleConfig extends PushServiceConfig {
  subscriptionStore: SubscriptionStore;
}

const CONFIG_TOKEN = Symbol('PUSH_NOTIFICATION_MODULE_CONFIG');

function validateConfig(config: PushNotificationModuleConfig): void {
  if (config.webpush) {
    const { vapidPublicKey, vapidPrivateKey, subject } = config.webpush;
    if (!vapidPublicKey || !vapidPrivateKey || !subject) {
      throw new Error('PushNotificationModule: webpush config requires vapidPublicKey, vapidPrivateKey, and subject');
    }
  }
  if (config.fcm && !config.fcm.serviceAccount) {
    throw new Error('PushNotificationModule: fcm config requires serviceAccount');
  }
  if (config.apns) {
    const { key, keyId, teamId, bundleId } = config.apns;
    if (!key || !keyId || !teamId || !bundleId) {
      throw new Error('PushNotificationModule: apns config requires key, keyId, teamId, and bundleId');
    }
  }
}

const pushServiceProvider: Provider = {
  provide: PushService,
  useFactory: (config: PushNotificationModuleConfig) => {
    validateConfig(config);
    return new PushService(config, config.subscriptionStore);
  },
  inject: [CONFIG_TOKEN],
};

const subscriptionStoreProvider: Provider = {
  provide: SUBSCRIPTION_STORE,
  useFactory: (config: PushNotificationModuleConfig) => config.subscriptionStore,
  inject: [CONFIG_TOKEN],
};

@Module({})
export class PushNotificationModule {
  static forRoot(config: PushNotificationModuleConfig): DynamicModule {
    return {
      module: PushNotificationModule,
      providers: [{ provide: CONFIG_TOKEN, useValue: config }, pushServiceProvider, subscriptionStoreProvider],
      exports: [PushService, SUBSCRIPTION_STORE],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => PushNotificationModuleConfig | Promise<PushNotificationModuleConfig>;
    inject?: (InjectionToken | OptionalFactoryDependency)[];
  }): DynamicModule {
    return {
      module: PushNotificationModule,
      providers: [
        { provide: CONFIG_TOKEN, useFactory: options.useFactory, inject: options.inject ?? [] },
        pushServiceProvider,
        subscriptionStoreProvider,
      ],
      exports: [PushService, SUBSCRIPTION_STORE],
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/push-notification.module.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/push-notification.module.ts src/server/__tests__/push-notification.module.spec.ts
git commit -m "feat: add PushNotificationModule with forRoot/forRootAsync"
```

---

### Task 8: NotificationController

**Files:**
- Create: `src/server/notification.controller.ts`
- Test: `src/server/__tests__/notification.controller.spec.ts`

**Interfaces:**
- Consumes: `NotificationLogStore`, `NOTIFICATION_LOG_STORE`, `NotificationAuthorizer`, `NOTIFICATION_AUTHORIZER` from `../index`.
- Produces: `NotificationController` (Nest controller, `@Inject(NOTIFICATION_LOG_STORE)` + `@Inject(NOTIFICATION_AUTHORIZER)`) — consumed by `server/index.ts` barrel (Task 14).

**Revision history:** the version below is the corrected, final form. A first pass shipped with no authorization at all (just `@Inject(NOTIFICATION_LOG_STORE)`, no ownership check on `:userId`/`:id`) and was caught by an automated security review as a HIGH-severity IDOR — any caller could read or mark-as-read any user's notifications. A doc-comment-only mitigation was tried first and rejected on re-review as inadequate (advisory-only, fails open). The fix below makes `NOTIFICATION_AUTHORIZER` a required constructor dependency — Nest fails to bootstrap without one — mirroring the same "consumer supplies the implementation, fails closed" idiom already used for `SubscriptionStore`.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/notification.controller.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { NotificationController } from '../notification.controller';
import type { NotificationAuthorizer, NotificationLogStore, NotificationRecord } from '../../index';

function makeStore(): NotificationLogStore {
  return { save: vi.fn(), findUnreadByUserId: vi.fn(), markAsRead: vi.fn() };
}

function makeAuthorizer(allow = true): NotificationAuthorizer {
  return {
    authorizeUserAccess: vi.fn().mockResolvedValue(allow),
    authorizeNotificationAccess: vi.fn().mockResolvedValue(allow),
  };
}

const record: NotificationRecord = {
  id: 'n-1',
  userId: 'user-1',
  title: 't',
  body: 'b',
  isRead: false,
  createdAt: new Date(),
};

const request = { headers: {} };

describe('NotificationController', () => {
  it('getNotifications returns unread list from store when authorized', async () => {
    const store = makeStore();
    (store.findUnreadByUserId as ReturnType<typeof vi.fn>).mockResolvedValue([record]);
    const authorizer = makeAuthorizer(true);
    const controller = new NotificationController(store, authorizer);

    const result = await controller.getNotifications('user-1', request);

    expect(authorizer.authorizeUserAccess).toHaveBeenCalledWith(request, 'user-1');
    expect(store.findUnreadByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([record]);
  });

  it('getNotifications throws ForbiddenException when not authorized', async () => {
    const store = makeStore();
    const authorizer = makeAuthorizer(false);
    const controller = new NotificationController(store, authorizer);

    await expect(controller.getNotifications('user-1', request)).rejects.toThrow(ForbiddenException);
    expect(store.findUnreadByUserId).not.toHaveBeenCalled();
  });

  it('markAsRead delegates to store and returns success when authorized', async () => {
    const store = makeStore();
    const authorizer = makeAuthorizer(true);
    const controller = new NotificationController(store, authorizer);

    const result = await controller.markAsRead('n-1', request);

    expect(authorizer.authorizeNotificationAccess).toHaveBeenCalledWith(request, 'n-1');
    expect(store.markAsRead).toHaveBeenCalledWith('n-1');
    expect(result).toEqual({ success: true });
  });

  it('markAsRead throws ForbiddenException when not authorized', async () => {
    const store = makeStore();
    const authorizer = makeAuthorizer(false);
    const controller = new NotificationController(store, authorizer);

    await expect(controller.markAsRead('n-1', request)).rejects.toThrow(ForbiddenException);
    expect(store.markAsRead).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/notification.controller.spec.ts`
Expected: FAIL — module `../notification.controller` not found.

- [ ] **Step 3: Write implementation**

`src/server/notification.controller.ts`. Note the split import: `NotificationLogStore`/`NotificationAuthorizer` must be `type`-only imports here — with this project's `isolatedModules` + `emitDecoratorMetadata` both on, TypeScript errors (`TS1272`) if a type used in a `@Inject`-decorated constructor parameter isn't explicitly imported as a type. `NOTIFICATION_LOG_STORE`/`NOTIFICATION_AUTHORIZER` stay normal value imports since they're used as the decorators' arguments, not just types.

```ts
import { Controller, ForbiddenException, Get, Inject, Param, Patch, Req } from '@nestjs/common';
import { NOTIFICATION_AUTHORIZER, NOTIFICATION_LOG_STORE } from '../index';
import type { NotificationAuthorizer, NotificationLogStore } from '../index';

/**
 * Not auto-registered by PushNotificationModule — add it to your own
 * module's `controllers` array to mount it, alongside a provider for
 * `NOTIFICATION_AUTHORIZER` (required — Nest fails to bootstrap without
 * one, by design, so this controller cannot be wired up unguarded).
 */
@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject(NOTIFICATION_LOG_STORE) private readonly store: NotificationLogStore,
    @Inject(NOTIFICATION_AUTHORIZER) private readonly authorizer: NotificationAuthorizer,
  ) {}

  @Get(':userId')
  async getNotifications(@Param('userId') userId: string, @Req() request: unknown) {
    if (!(await this.authorizer.authorizeUserAccess(request, userId))) {
      throw new ForbiddenException();
    }
    return this.store.findUnreadByUserId(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() request: unknown) {
    if (!(await this.authorizer.authorizeNotificationAccess(request, id))) {
      throw new ForbiddenException();
    }
    await this.store.markAsRead(id);
    return { success: true };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/notification.controller.spec.ts`
Expected: PASS — 4/4 tests (2 authorized-path, 2 forbidden-path)

- [ ] **Step 5: Commit**

```bash
git add src/server/notification.controller.ts src/server/__tests__/notification.controller.spec.ts
git commit -m "feat: add NotificationController with required authorization check"
```

---

### Task 9: NotificationWebhookController (opt-in)

**Files:**
- Create: `src/server/notification-webhook.controller.ts`
- Test: `src/server/__tests__/notification-webhook.controller.spec.ts`

**Interfaces:**
- Consumes: `PushService` (Task 6) for `pruneTarget`; `NotificationWebhookVerifier`, `NOTIFICATION_WEBHOOK_VERIFIER` from `../index`.
- Produces: `NotificationWebhookController`, and a new `PushService.pruneTarget(userId, target)` public method (adds to the class from Task 6) — consumed by `server/index.ts` barrel (Task 14). Not auto-registered by `PushNotificationModule`; consumer imports it explicitly.

**Security note (learned from Task 8):** this endpoint is unauthenticated by nature — it's meant to be called by an external aggregator, not a logged-in user, so there's no `userId`/session to check like Task 8's controller. But without ANY verification, anyone who can reach it could POST a fabricated `status: 'failed'` body and prune an arbitrary user's push subscription. `NotificationWebhookVerifier` is a required constructor dependency (same fail-closed idiom as `NotificationAuthorizer`) so this can't be wired up without the consumer deciding how to verify the caller (typically an HMAC signature check against their aggregator's shared secret).

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/notification-webhook.controller.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { NotificationWebhookController } from '../notification-webhook.controller';
import { PushService } from '../push.service';
import type { NotificationWebhookVerifier } from '../../index';

function makeService() {
  return { pruneTarget: vi.fn() } as unknown as PushService;
}

function makeVerifier(allow = true): NotificationWebhookVerifier {
  return { verify: vi.fn().mockResolvedValue(allow) };
}

const request = { headers: {} };

describe('NotificationWebhookController', () => {
  it('acknowledges receipt for a well-formed, verified body', async () => {
    const service = makeService();
    const verifier = makeVerifier(true);
    const controller = new NotificationWebhookController(service, verifier);

    const result = await controller.handleDeliveryReport(
      {
        event: 'delivery.ok',
        userId: 'user-1',
        target: { type: 'fcm', userId: 'user-1', token: 'tok-1' },
        status: 'ok',
      },
      request,
    );

    expect(verifier.verify).toHaveBeenCalledWith(request);
    expect(result).toEqual({ received: true });
    expect(service.pruneTarget).not.toHaveBeenCalled();
  });

  it('prunes target when status is failed and verified', async () => {
    const service = makeService();
    const verifier = makeVerifier(true);
    const controller = new NotificationWebhookController(service, verifier);
    const target = { type: 'fcm' as const, userId: 'user-1', token: 'tok-1' };

    await controller.handleDeliveryReport(
      { event: 'delivery.failed', userId: 'user-1', target, status: 'failed' },
      request,
    );

    expect(service.pruneTarget).toHaveBeenCalledWith('user-1', target);
  });

  it('throws ForbiddenException and never touches the service when verification fails', async () => {
    const service = makeService();
    const verifier = makeVerifier(false);
    const controller = new NotificationWebhookController(service, verifier);
    const target = { type: 'fcm' as const, userId: 'user-1', token: 'tok-1' };

    await expect(
      controller.handleDeliveryReport({ event: 'delivery.failed', userId: 'user-1', target, status: 'failed' }, request),
    ).rejects.toThrow(ForbiddenException);
    expect(service.pruneTarget).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/notification-webhook.controller.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add `pruneTarget` to `PushService`**

Modify `src/server/push.service.ts` — add this public method to the `PushService` class (alongside `send`/`sendBulk`):

```ts
  async pruneTarget(userId: string, target: PushTarget): Promise<void> {
    await this.store.delete(userId, target);
  }
```

- [ ] **Step 4: Write `notification-webhook.controller.ts`**

Note the split import, same TS1272 reason as Task 8: `NotificationWebhookVerifier` is only ever used as a type, so it needs `import type`, while `NOTIFICATION_WEBHOOK_VERIFIER` stays a value import (it's the decorator's argument).

```ts
import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { NOTIFICATION_WEBHOOK_VERIFIER } from '../index';
import type { PushTarget, NotificationWebhookVerifier } from '../index';
import { PushService } from './push.service';

interface DeliveryReportBody {
  event: string;
  userId: string;
  target: PushTarget;
  status: 'ok' | 'failed';
}

/**
 * Opt-in: import and register this controller only if an aggregator
 * (OneSignal, Airship, etc.) is configured to POST here. The three
 * built-in providers (web-push/FCM/APNs) never call this endpoint —
 * they report failures synchronously in the send response instead.
 *
 * Requires a `NOTIFICATION_WEBHOOK_VERIFIER` provider (required — Nest
 * fails to bootstrap without one) to confirm the request actually came
 * from your aggregator before acting on it.
 */
@Controller('webhooks/notifications')
export class NotificationWebhookController {
  constructor(
    private readonly pushService: PushService,
    @Inject(NOTIFICATION_WEBHOOK_VERIFIER) private readonly verifier: NotificationWebhookVerifier,
  ) {}

  @Post('delivery-report')
  @HttpCode(HttpStatus.OK)
  async handleDeliveryReport(@Body() body: DeliveryReportBody, @Req() request: unknown) {
    if (!(await this.verifier.verify(request))) {
      throw new ForbiddenException();
    }
    if (body.status === 'failed') {
      await this.pushService.pruneTarget(body.userId, body.target);
    }
    return { received: true };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/notification-webhook.controller.spec.ts src/server/__tests__/push.service.spec.ts`
Expected: PASS — 3/3 in the new file (both files together confirm the `pruneTarget` addition didn't break Task 6's tests)

- [ ] **Step 6: Commit**

```bash
git add src/server/notification-webhook.controller.ts src/server/__tests__/notification-webhook.controller.spec.ts src/server/push.service.ts
git commit -m "feat: add opt-in NotificationWebhookController with required signature verification"
```

---

### Task 10: TypeORM adapter

**Files:**
- Create: `src/typeorm/push-subscription.entity.ts`
- Create: `src/typeorm/notification.entity.ts`
- Create: `src/typeorm/typeorm-subscription-store.ts`
- Create: `src/typeorm/typeorm-notification-log-store.ts`
- Test: `src/typeorm/__tests__/typeorm-subscription-store.spec.ts`
- Test: `src/typeorm/__tests__/typeorm-notification-log-store.spec.ts`

**Interfaces:**
- Consumes: `SubscriptionStore`, `NotificationLogStore`, `PushTarget`, `NotificationRecord` from `../index`.
- Produces: `PushSubscriptionEntity`, `NotificationEntity`, `TypeOrmSubscriptionStore`, `TypeOrmNotificationLogStore` — consumed by `typeorm/index.ts` barrel (Task 14).

- [ ] **Step 1: Write the failing tests**

`src/typeorm/__tests__/typeorm-subscription-store.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { PushSubscriptionEntity } from '../push-subscription.entity';
import { TypeOrmSubscriptionStore } from '../typeorm-subscription-store';
import type { PushTarget } from '../../index';

let dataSource: DataSource;
let store: TypeOrmSubscriptionStore;

beforeEach(async () => {
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [PushSubscriptionEntity],
    synchronize: true,
  });
  await dataSource.initialize();
  store = new TypeOrmSubscriptionStore(dataSource.getRepository(PushSubscriptionEntity));
});

afterEach(async () => dataSource.destroy());

const target: PushTarget = { type: 'fcm', userId: 'user-1', token: 'tok-1' };

describe('TypeOrmSubscriptionStore', () => {
  it('saves and finds by userId', async () => {
    await store.save('user-1', target);
    const found = await store.findByUserId('user-1');
    expect(found).toEqual([target]);
  });

  it('deletes a target', async () => {
    await store.save('user-1', target);
    await store.delete('user-1', target);
    expect(await store.findByUserId('user-1')).toEqual([]);
  });

  it('findAll returns targets across users', async () => {
    await store.save('user-1', target);
    await store.save('user-2', { type: 'fcm', userId: 'user-2', token: 'tok-2' });
    expect(await store.findAll()).toHaveLength(2);
  });
});
```

`src/typeorm/__tests__/typeorm-notification-log-store.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { NotificationEntity } from '../notification.entity';
import { TypeOrmNotificationLogStore } from '../typeorm-notification-log-store';

let dataSource: DataSource;
let store: TypeOrmNotificationLogStore;

beforeEach(async () => {
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [NotificationEntity],
    synchronize: true,
  });
  await dataSource.initialize();
  store = new TypeOrmNotificationLogStore(dataSource.getRepository(NotificationEntity));
});

afterEach(async () => dataSource.destroy());

describe('TypeOrmNotificationLogStore', () => {
  it('saves a record and finds unread by userId', async () => {
    await store.save({ userId: 'user-1', title: 't', body: 'b' });
    const unread = await store.findUnreadByUserId('user-1');
    expect(unread).toHaveLength(1);
    expect(unread[0].isRead).toBe(false);
  });

  it('markAsRead excludes it from unread results', async () => {
    const record = await store.save({ userId: 'user-1', title: 't', body: 'b' });
    await store.markAsRead(record.id);
    expect(await store.findUnreadByUserId('user-1')).toEqual([]);
  });

  it('orders unread results newest first', async () => {
    await store.save({ userId: 'user-1', title: 'first', body: 'b' });
    await store.save({ userId: 'user-1', title: 'second', body: 'b' });
    const unread = await store.findUnreadByUserId('user-1');
    expect(unread[0].title).toBe('second');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/typeorm/__tests__/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the entities**

`src/typeorm/push-subscription.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { PushTarget } from '../index';

@Entity()
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'simple-json' })
  target: PushTarget;

  @CreateDateColumn()
  createdAt: Date;
}
```

`src/typeorm/notification.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 4: Write the stores**

`src/typeorm/typeorm-subscription-store.ts`:

```ts
import type { Repository } from 'typeorm';
import type { PushTarget, SubscriptionStore } from '../index';
import { PushSubscriptionEntity } from './push-subscription.entity';

export class TypeOrmSubscriptionStore implements SubscriptionStore {
  constructor(private readonly repo: Repository<PushSubscriptionEntity>) {}

  async save(userId: string, target: PushTarget): Promise<void> {
    await this.repo.save(this.repo.create({ userId, target }));
  }

  async findByUserId(userId: string): Promise<PushTarget[]> {
    const rows = await this.repo.find({ where: { userId } });
    return rows.map((row) => row.target);
  }

  async delete(userId: string, target: PushTarget): Promise<void> {
    const rows = await this.repo.find({ where: { userId } });
    const match = rows.find((row) => JSON.stringify(row.target) === JSON.stringify(target));
    if (match) await this.repo.delete(match.id);
  }

  async findAll(): Promise<PushTarget[]> {
    const rows = await this.repo.find();
    return rows.map((row) => row.target);
  }
}
```

`src/typeorm/typeorm-notification-log-store.ts`:

```ts
import type { Repository } from 'typeorm';
import type { NotificationLogStore, NotificationRecord } from '../index';
import { NotificationEntity } from './notification.entity';

export class TypeOrmNotificationLogStore implements NotificationLogStore {
  constructor(private readonly repo: Repository<NotificationEntity>) {}

  async save(record: { userId: string; title: string; body: string }): Promise<NotificationRecord> {
    const saved = await this.repo.save(this.repo.create(record));
    return saved;
  }

  async findUnreadByUserId(userId: string): Promise<NotificationRecord[]> {
    return this.repo.find({ where: { userId, isRead: false }, order: { createdAt: 'DESC' } });
  }

  async markAsRead(id: string): Promise<void> {
    await this.repo.update(id, { isRead: true });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/typeorm/__tests__/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/typeorm/push-subscription.entity.ts src/typeorm/notification.entity.ts src/typeorm/typeorm-subscription-store.ts src/typeorm/typeorm-notification-log-store.ts src/typeorm/__tests__
git commit -m "feat: add optional TypeORM adapter for subscription and notification log stores"
```

---

### Task 11: usePushPermission hook

**Files:**
- Create: `src/react/use-push-permission.ts`
- Test: `src/react/__tests__/use-push-permission.test.tsx`

**Interfaces:**
- Produces: `usePushPermission(): { permission: NotificationPermission | 'unsupported'; request(): Promise<NotificationPermission> }` — consumed by `usePushSubscription` (Task 12) and `react/index.ts` barrel (Task 14).

- [ ] **Step 1: Write the failing test**

`src/react/__tests__/use-push-permission.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePushPermission } from '../use-push-permission';

beforeEach(() => {
  vi.stubGlobal('Notification', {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
});

describe('usePushPermission', () => {
  it('reads current Notification.permission', () => {
    const { result } = renderHook(() => usePushPermission());
    expect(result.current.permission).toBe('default');
  });

  it('request() calls Notification.requestPermission and updates state', async () => {
    const { result } = renderHook(() => usePushPermission());

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.permission).toBe('granted');
  });

  it('reports unsupported when Notification is undefined', () => {
    vi.stubGlobal('Notification', undefined);
    const { result } = renderHook(() => usePushPermission());
    expect(result.current.permission).toBe('unsupported');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/__tests__/use-push-permission.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/react/use-push-permission.ts`:

```ts
import { useCallback, useState } from 'react';

export function usePushPermission() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const request = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported' as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, request };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/__tests__/use-push-permission.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/react/use-push-permission.ts src/react/__tests__/use-push-permission.test.tsx
git commit -m "feat: add usePushPermission hook"
```

---

### Task 12: usePushSubscription hook (VAPID native)

**Files:**
- Create: `src/react/use-push-subscription.ts`
- Test: `src/react/__tests__/use-push-subscription.test.tsx`

**Interfaces:**
- Produces: `usePushSubscription({ vapidPublicKey, swPath }): { subscription: PushSubscription | null; status: 'idle'|'subscribing'|'subscribed'|'error'; subscribe(): Promise<void>; unsubscribe(): Promise<void> }` — consumed by `react/index.ts` barrel (Task 14).

- [ ] **Step 1: Write the failing test**

`src/react/__tests__/use-push-subscription.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePushSubscription } from '../use-push-subscription';

const mockSubscription = { endpoint: 'https://push.example/1' };
const subscribeMock = vi.fn().mockResolvedValue(mockSubscription);
const unsubscribeMock = vi.fn().mockResolvedValue(undefined);
const getSubscriptionMock = vi.fn().mockResolvedValue(null);

beforeEach(() => {
  subscribeMock.mockClear();
  unsubscribeMock.mockClear();

  vi.stubGlobal('navigator', {
    serviceWorker: {
      register: vi.fn().mockResolvedValue({
        pushManager: { subscribe: subscribeMock, getSubscription: getSubscriptionMock },
      }),
    },
  });
});

describe('usePushSubscription', () => {
  it('starts idle with no subscription', () => {
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));
    expect(result.current.status).toBe('idle');
    expect(result.current.subscription).toBeNull();
  });

  it('subscribe() registers service worker and subscribes to push', async () => {
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));

    await act(async () => {
      await result.current.subscribe();
    });

    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    expect(subscribeMock).toHaveBeenCalledOnce();
    expect(result.current.subscription).toEqual(mockSubscription);
  });

  it('unsubscribe() clears subscription state', async () => {
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));
    await act(async () => {
      await result.current.subscribe();
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(result.current.subscription).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('sets status to error when subscribe throws', async () => {
    subscribeMock.mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/__tests__/use-push-subscription.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/react/use-push-subscription.ts`:

```ts
import { useCallback, useState } from 'react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function usePushSubscription(opts: { vapidPublicKey: string; swPath: string }) {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');

  const subscribe = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      setStatus('error');
      return;
    }
    setStatus('subscribing');
    try {
      const registration = await navigator.serviceWorker.register(opts.swPath);
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(opts.vapidPublicKey),
      });
      setSubscription(sub as unknown as PushSubscription);
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }, [opts.swPath, opts.vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    setSubscription(null);
    setStatus('idle');
  }, []);

  return { subscription, status, subscribe, unsubscribe };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/__tests__/use-push-subscription.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/react/use-push-subscription.ts src/react/__tests__/use-push-subscription.test.tsx
git commit -m "feat: add usePushSubscription hook for VAPID web push"
```

---

### Task 13: usePushSubscriptionFcm hook

**Files:**
- Create: `src/react/use-push-subscription-fcm.ts`
- Test: `src/react/__tests__/use-push-subscription-fcm.test.tsx`

**Interfaces:**
- Produces: `usePushSubscriptionFcm({ firebaseConfig, vapidKey }): { token: string | null; status: 'idle'|'subscribing'|'subscribed'|'error'; subscribe(): Promise<void> }` — consumed by `react/index.ts` barrel (Task 14).

- [ ] **Step 1: Write the failing test**

`src/react/__tests__/use-push-subscription-fcm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getTokenMock = vi.fn();
const getMessagingMock = vi.fn(() => ({}));
const initializeAppMock = vi.fn(() => ({}));

vi.mock('firebase/app', () => ({ initializeApp: initializeAppMock }));
vi.mock('firebase/messaging', () => ({ getMessaging: getMessagingMock, getToken: getTokenMock }));

import { usePushSubscriptionFcm } from '../use-push-subscription-fcm';

beforeEach(() => {
  getTokenMock.mockReset();
  initializeAppMock.mockClear();
});

describe('usePushSubscriptionFcm', () => {
  it('starts idle with no token', () => {
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.token).toBeNull();
  });

  it('subscribe() initializes firebase and stores the token', async () => {
    getTokenMock.mockResolvedValue('fcm-token-abc');
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );

    await act(async () => {
      await result.current.subscribe();
    });

    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    expect(result.current.token).toBe('fcm-token-abc');
  });

  it('sets status to error when getToken throws', async () => {
    getTokenMock.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/__tests__/use-push-subscription-fcm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/react/use-push-subscription-fcm.ts`:

```ts
import { useCallback, useState } from 'react';

export function usePushSubscriptionFcm(opts: { firebaseConfig: object; vapidKey: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');

  const subscribe = useCallback(async () => {
    setStatus('subscribing');
    try {
      const { initializeApp } = await import('firebase/app');
      const { getMessaging, getToken } = await import('firebase/messaging');
      const app = initializeApp(opts.firebaseConfig);
      const messaging = getMessaging(app);
      const fcmToken = await getToken(messaging, { vapidKey: opts.vapidKey });
      setToken(fcmToken);
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }, [opts.firebaseConfig, opts.vapidKey]);

  return { token, status, subscribe };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/__tests__/use-push-subscription-fcm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/react/use-push-subscription-fcm.ts src/react/__tests__/use-push-subscription-fcm.test.tsx
git commit -m "feat: add usePushSubscriptionFcm hook for FCM web tokens"
```

---

### Task 14: Wire barrel exports and verify multi-entry build

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/react/index.ts`
- Modify: `src/typeorm/index.ts`

**Interfaces:**
- Consumes: every symbol produced by Tasks 2–13.
- Produces: the four public entry points (`.`, `./server`, `./react`, `./typeorm`) as actually resolvable by consumers.

- [ ] **Step 1: Write `src/server/index.ts`**

```ts
export { PushNotificationModule, type PushNotificationModuleConfig } from './push-notification.module';
export { PushService, ProviderNotConfiguredError, type PushServiceConfig } from './push.service';
export { NotificationController } from './notification.controller';
export { NotificationWebhookController } from './notification-webhook.controller';
export type { WebPushConfig } from './providers/webpush.provider';
export type { FcmConfig } from './providers/fcm.provider';
export type { ApnsConfig } from './providers/apns.provider';
```

- [ ] **Step 2: Write `src/react/index.ts`**

```ts
export { usePushPermission } from './use-push-permission';
export { usePushSubscription } from './use-push-subscription';
export { usePushSubscriptionFcm } from './use-push-subscription-fcm';
```

- [ ] **Step 3: Write `src/typeorm/index.ts`**

```ts
export { PushSubscriptionEntity } from './push-subscription.entity';
export { NotificationEntity } from './notification.entity';
export { TypeOrmSubscriptionStore } from './typeorm-subscription-store';
export { TypeOrmNotificationLogStore } from './typeorm-notification-log-store';
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all suites PASS (Tasks 2–13's tests, re-verified against the barrels).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Run build and verify all four entries**

Run: `npm run build`
Expected: `dist/index.{js,cjs,d.ts}`, `dist/server.{js,cjs,d.ts}`, `dist/react.{js,cjs,d.ts}`, `dist/typeorm.{js,cjs,d.ts}` all created without errors.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/index.ts src/react/index.ts src/typeorm/index.ts
git commit -m "feat: wire barrel exports for server, react, and typeorm entry points"
```

---

### Task 15: README and final verification

**Files:**
- Create: `README.md`
- Modify: none (verification only)

**Interfaces:**
- Consumes: nothing new — documents the public API surface from Tasks 2–14.

- [ ] **Step 1: Write `README.md`**

```markdown
# @idevconn/push-notifications

Host-agnostic push notifications for Nest 11 + React 19: Web Push (VAPID),
FCM, and APNs sending, subscription management, and notification history.

## Install

\`\`\`bash
npm install @idevconn/push-notification
# plus whichever providers you use:
npm install web-push        # Web Push
npm install firebase-admin   # FCM
npm install @parse/node-apn  # APNs
npm install typeorm @nestjs/typeorm  # optional TypeORM storage adapter
npm install firebase         # FCM web token hook (client)
\`\`\`

## Server (Nest 11)

\`\`\`ts
import { PushNotificationModule } from '@idevconn/push-notifications/server';

@Module({
  imports: [
    PushNotificationModule.forRoot({
      webpush: { vapidPublicKey, vapidPrivateKey, subject: 'mailto:you@example.com' },
      fcm: { serviceAccount },
      apns: { key, keyId, teamId, bundleId },
      subscriptionStore: myStore, // implements SubscriptionStore
    }),
  ],
})
export class AppModule {}
\`\`\`

## React 19

\`\`\`ts
import { usePushPermission, usePushSubscription } from '@idevconn/push-notifications/react';
\`\`\`

## TypeORM adapter

\`\`\`ts
import { PushSubscriptionEntity, TypeOrmSubscriptionStore } from '@idevconn/push-notifications/typeorm';
\`\`\`

See \`docs/superpowers/specs/2026-09-07-push-notification-design.md\` for full design rationale.
```

- [ ] **Step 2: Full verification pass**

Run: `npm run typecheck && npm test && npm run build && npm run lint`
Expected: all pass — this is the same sequence as `prepublishOnly`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with install and usage examples"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```
