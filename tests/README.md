# Test Suite Documentation

## Quick Start

### Math Fixes Verification (Quick Test)

Verify that all Math.abs/min/max fixes are working correctly:

```bash
# Make sure server is running on port 8000
npm run verify-math

# Or run directly
node verify-math-fixes.js
```

**Expected output:**
```
✅ Server responding at http://localhost:8000
✅ THREE.js loaded
✅ WebGL canvas element found
✅ No Math errors in console
✅ Application functional

🎉 VERIFICATION: PASSED
```

### Full E2E Test Suite

Run all Playwright end-to-end tests:

```bash
# Run all tests (starts vite dev server automatically)
npm test

# Run with UI mode for debugging
npm run test:ui

# Run specific test file
npx playwright test tests/e2e/math-fixes-verification.spec.js
```

## Test Files

### Math Verification Tests

| File | Purpose | Runtime | Command |
|------|---------|---------|---------|
| `verify-math-fixes.js` | Quick Math fixes check (Node.js) | ~8s | `npm run verify-math` |
| `e2e/math-fixes-verification.spec.js` | Full Math verification (Playwright) | ~30s | `npx playwright test math-fixes` |

### Existing E2E Tests

| File | Purpose |
|------|---------|
| `e2e/navigation.spec.js` | Navigation and routing tests |
| `e2e/phase1-validation.spec.js` | Phase 1 feature validation |
| `e2e/phase2-elliptical-orbits.spec.js` | Elliptical orbit mechanics |
| `e2e/space-environment-validation.spec.js` | Space environment rendering |
| `e2e/gravitational-waves.spec.js` | Gravitational wave effects |

## Test Configuration

### Playwright Configs

| Config File | Port | Purpose |
|-------------|------|---------|
| `playwright.config.js` | 3000 | Default config (starts vite) |
| `playwright.config.math-test.js` | 8000 | Math verification (uses running server) |

### Running Against Different Ports

**Port 8000 (manual server):**
```bash
npx playwright test --config=playwright.config.math-test.js
```

**Port 3000 (vite auto-start):**
```bash
npm test
```

## Math Fixes Background

### What Was Fixed (2026-01-04)

Fixed 10 Math method errors across 4 files:

| File | Errors Fixed | Methods |
|------|--------------|---------|
| CosmicDust.js | 3 | Math.abs, Math.min |
| Sun.js | 2 | Math.abs, Math.max |
| Planet.js | 3 | Math.abs, Math.min |
| ExtraDimensionsViz.js | 2 | Math.abs, Math.max |

**Root Cause:** Math methods were being called incorrectly (e.g., `Math.abs(value)` instead of using Math directly)

**Fix Pattern:**
```javascript
// Before (ERROR)
const abs = Math.abs;
const result = abs(value);  // TypeError: Math.abs is not a function

// After (FIXED)
const result = Math.abs(value);  // Correct
```

### Verification Report

Full verification results: `MATH-FIXES-VERIFICATION-REPORT.md`

## Troubleshooting

### Server Not Running

```
❌ Server not responding: connect ECONNREFUSED
```

**Solution:** Start the server first:
```bash
# Terminal 1
npm run legacy-server

# Terminal 2
npm run verify-math
```

### Playwright Installation

If Playwright browsers aren't installed:
```bash
npx playwright install chromium
```

### Node Version

Requires Node.js 18.19+ for ESM support. Check version:
```bash
node --version  # Should be v18.19.0 or higher
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Verify Math Fixes
  run: |
    npm run legacy-server &
    sleep 5
    npm run verify-math
```

## Test Maintenance

### Adding New Tests

1. Create test file in `tests/e2e/`
2. Follow existing pattern (see `math-fixes-verification.spec.js`)
3. Update this README with new test description

### Updating Math Verification

If you make changes to Math-related code:

1. Run verification: `npm run verify-math`
2. Check for new errors
3. Fix any regressions
4. Update `MATH-FIXES-VERIFICATION-REPORT.md`

## Contact

For questions about tests, see project maintainer or check:
- Project docs: `../DevelopmentNotes.md`
- Architecture: `../Architecture.md`
