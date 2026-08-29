# Troubleshooting Guide

Common failures when setting up, building, or testing the ZK Payroll SDK.

## CI Failures

### `npm ci` fails with "package-lock.json not found"

```
npm ERR! cipm can only install packages when your package.json and package-lock.json
or npm-shrinkwrap.json are in sync.  Missing: package-lock.json
```

**Root cause:** `package-lock.json` is listed in `.gitignore`, so it is absent in CI checkouts. The CI pipeline runs `npm ci`, which requires a lockfile.

**Fix:** Either commit the lockfile or change CI to use `npm install` instead of `npm ci`. If keeping the lockfile out of version control, update `.github/workflows/ci.yml`:

```yaml
- name: Install dependencies
  run: npm install
```

### CI lint step fails with "Parsing error: ESLint has exited unexpectedly"

```
Error: ESLint has exited unexpectedly. This may indicate a compatibility issue.
```

**Root cause:** ESLint `^10.x` may have compatibility issues with `@typescript-eslint` plugins when the Node.js version does not match exactly or the plugin versions are too new.

**Fix:** Ensure CI runs on the exact Node.js version specified in `packageManager`:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20
```

Pin `@typescript-eslint/*` versions to match ESLint 10 if needed.

### Typecheck step fails in CI but passes locally

```
src/adapters/BaseContractWrapper.ts:42:3 - error TS2322: Type 'X' is not assignable to type 'Y'
```

**Root cause:** Local `node_modules` may have stale or different dependency versions. CI performs a clean install.

**Fix:** Run `npm run clean` before rebuilding locally, and verify with `npm run typecheck`. Ensure your local Node.js matches CI (v20).

### Test step times out

```
Jest did not exit one second after the test run has completed.
```

**Root cause:** An open handle (e.g., a timer, WebSocket, or unfinished async operation) is not being cleaned up, often in ZK proof generator tests.

**Fix:** Add `--forceExit` to the Jest command in `packages/core/package.json`:

```json
"test": "jest --forceExit"
```

Alternatively, ensure all async resources are properly cleaned up in `afterEach` / `afterAll` hooks.

## Dependency Issues

### Duplicate Stellar SDK versions

Two versions of the Stellar SDK are listed as dependencies:

```
"@stellar/stellar-sdk": "^14.5.0"
"stellar-sdk": "^11.0.0"
```

**Root cause:** `stellar-sdk` v11 is the legacy package. `@stellar/stellar-sdk` v14 is the current one. Both are installed, inflating bundle size and potentially causing type conflicts.

**Fix:** Remove the legacy `stellar-sdk` dependency and migrate any imports to `@stellar/stellar-sdk`. See [BUNDLE_SIZE.md](./BUNDLE_SIZE.md) for the migration plan.

### "Cannot find module '@zk-payroll/core'" or workspace resolution errors

```
Error: Cannot find module '@zk-payroll/core'
```

**Root cause:** The monorepo uses npm workspaces. If `npm install` was run from `packages/core/` instead of the root, the workspace symlinks are not set up.

**Fix:** Always run `npm install` from the repository root:

```bash
cd zk-payroll-sdk
npm install
```

### "snarkjs" fails to load in Node.js

```
Error: Cannot find module 'snarkjs'
-- OR --
Error: WebAssembly is not supported in this environment
```

**Root cause:** `snarkjs` requires WASM support. Older Node.js versions or certain restricted environments may not support it.

**Fix:** Use Node.js 20+. Verify WASM support:

```bash
node -e "console.log(typeof WebAssembly)"
```

### Axios dependency flagged as security vulnerability

**Root cause:** The project bundles `axios ^1.7.0` for HTTP downloads of circuit artifacts. Axios has had historical CVEs.

**Fix:** Run `npm audit fix` to patch. For a permanent fix, migrate to the built-in `fetch` API (Node.js 18+). See `docs/BUNDLE_SIZE.md`.

### lockfile drift after git operations

```
npm ERR! code EINTEGRITY
npm ERR! sha512-... integrity checksum failed when using sha512: wanted sha512-... but got sha512-...
```

**Root cause:** `package-lock.json` may be locally generated but differ from the repository state if the lockfile was regenerated on a different platform or npm version.

**Fix:** Delete `node_modules` and regenerate the lockfile with the correct npm version:

```bash
rm -rf node_modules
npm install
```

## Environment Misconfiguration

### Node.js version mismatch

```
You are running Node.js X.X.X. This project requires Node.js 20.
```

**Root cause:** The project pins Node.js 20 in `packageManager` (`npm@10.8.2`) and CI. Running a different version causes build or runtime failures.

**Fix:** Use `nvm` or `fnm` to switch to the correct version:

```bash
nvm install 20
nvm use 20
node --version  # should be v20.x.x
```

### `DEFAULT_CONFIG.contractId` is empty

```
Error: Invalid contract ID
```

**Root cause:** The shipped `DEFAULT_CONFIG` has `contractId: ""`. Using it without setting a real contract ID will fail.

**Fix:** Provide a valid contract ID:

```typescript
const config = { ...DEFAULT_CONFIG, contractId: "CCONTRACT_ID..." };
```

### Import path confusion (dual `src/` directories)

The repository has two `src/` directories:

```
src/                         # stale/orphaned
packages/core/src/           # actual source
```

Importing from the stale root `src/` will resolve but is **incorrect**.

**Root cause:** A leftover duplicate `src/` at the repository root mirrors `packages/core/src/`. Import paths may resolve to the wrong one depending on how tools resolve modules.

**Fix:** Always import from the workspace package:

```typescript
// ✅ Correct
import { PayrollService } from "@zk-payroll/core";

// ❌ Wrong (stale root)
import { PayrollService } from "../../src";
```

The stale `src/` should be deleted:

```bash
rm -rf src/
```

### Using `LocalStorageCacheProvider` in Node.js

```
ReferenceError: localStorage is not defined
```

**Root cause:** `LocalStorageCacheProvider` accesses `localStorage`, which only exists in browser environments. Tests and Node.js scripts use a Node environment.

**Fix:** Use `MemoryCacheProvider` in Node.js environments:

```typescript
import { MemoryCacheProvider } from "@zk-payroll/core";
const cache = new MemoryCacheProvider<string>();
```

### "Failed to fetch .wasm file" or ".zkey file"

See [ZK Proof Generation Troubleshooting](./ZK_PROOF_GENERATION.md#troubleshooting) for detailed fixes covering CORS, timeouts, and file availability.

### "Expectations not met" / "Unexpected invocation" in tests

See [Testing Troubleshooting](./TESTING.md#troubleshooting) for mock environment issues including strict mode, unmocked methods, and type mismatches.

### Prettier and ESLint formatting conflicts

```
src/file.ts:1:1 - Warning: Replace '·' with '··' (prettier/prettier)
```

**Root cause:** Prettier and ESLint disagree on formatting. The project uses `eslint-plugin-prettier` which runs Prettier as an ESLint rule.

**Fix:** Run the formatter to sync formatting:

```bash
npm run format
```

If conflicts persist, check `.prettierrc` settings match `eslint-config-prettier` expectations.

### Build fails with `rimraf` permission errors

```
Error: EACCES: permission denied, unlink 'dist/...'
```

**Root cause:** The `build` script runs `rimraf dist && tsc`. If `dist` contains files owned by a different user (e.g., from Docker or `sudo`), deletion fails.

**Fix:** Manually remove `dist` before building:

```bash
rm -rf packages/core/dist
npm run build
```

### TypeScript strict mode errors on new code

```
src/file.ts:10:3 - error TS2532: Object is possibly 'undefined'.
```

**Root cause:** The project enables `strict: true` in `tsconfig.base.json`. New code must handle `null`/`undefined` properly.

**Fix:** Use optional chaining, nullish coalescing, or explicit type guards:

```typescript
// ✅ Correct
const id = obj?.id ?? "default";

// ❌ Wrong (strict mode error)
const id = obj.id;
```

## Still Stuck?

- Check [TESTING.md](./TESTING.md) for mock environment issues
- Check [ZK_PROOF_GENERATION.md](./ZK_PROOF_GENERATION.md) for proof generation issues
- Check [API.md](./API.md) for correct client usage
- Open a [GitHub issue](https://github.com/anomalyco/opencode/issues) with the full error output and your environment details (`node --version`, `npm --version`, OS)
