# Quality Mission: 100% Test & Code Coverage — Hermes Repo

## Context

**Repo:** `~/repos/Hermes` (hermes-agent codebase)
**Current State:**
- 19,112/19,135 tests collected (23 deselected) — 9 collection errors
- Ruff, mypy, bandit pre-configured
- Pre-commit hooks exist (incomplete push protection)
- No coverage thresholds in CI
- No e2e tests in CI
- No WCAG/accessibility testing

**Goal:** 100% test coverage, strict linting, ruff audit, e2e testing, WCAG 2.1 AAA, pre-commit/push hooks enforcing all tests.

---

## Phase 1: Fix Test Collection Errors (IMMEDIATE)

**Problem:** 9 tests fail collection due to `ModuleNotFoundError: No module named 'acp'`

**Files affected:**
```
tests/acp/test_entry.py
tests/acp/test_events.py
tests/acp/test_mcp_e2e.py
tests/acp/test_permissions.py
tests/acp/test_ping_suppression.py
tests/acp/test_server.py
tests/acp/test_tools.py
tests/acp_adapter/test_acp_commands.py
tests/acp_adapter/test_acp_images.py
```

**Fix:** Install `acp` package or mock it. The `acp` package is `agent-client-protocol` from PyPI. Either:
1. `pip install agent-client-protocol` in the test environment
2. OR add `acp` to the test dependencies in `pyproject.toml`

**Verification:**
```bash
cd ~/repos/Hermes
python -m pytest --collect-only 2>&1 | grep "ERROR" | wc -l
# Should be 0
```

---

## Phase 2: Establish Clean Linting Baseline

**Run all linters and collect issues:**

```bash
cd ~/repos/Hermes
source .venv/bin/activate

# Ruff lint
ruff check . 2>&1 | head -100

# Ruff format check
ruff format --check . 2>&1 | head -50

# Ruff security audit
ruff check --select=S . 2>&1 | head -50

# Bandit
bandit -r hermes_cli agent tools gateway tui_gateway cron acp_adapter plugins src 2>&1 | head -50

# MyPy
mypy hermes_cli agent tools gateway tui_gateway cron acp_adapter plugins --ignore-missing-imports --no-strict-optional 2>&1 | head -100
```

**Fix strategy:** Use `ruff --fix` for auto-fixable issues. Manually fix the rest.

---

## Phase 3: Establish Coverage Baseline

**Run coverage analysis:**

```bash
cd ~/repos/Hermes
source .venv/bin/activate

# Run tests with coverage
python -m pytest tests/ -m 'not integration' -n auto --cov=. --cov-report=term-missing --cov-report=html 2>&1 | tail -50

# Generate HTML report
# Open htmlcov/index.html for detailed analysis
```

**Key metrics to track:**
- Line coverage %
- Branch coverage %
- Function coverage %
- Per-module breakdown

---

## Phase 4: Identify and Fix Coverage Gaps

**Priority order:**
1. `src/` modules (core logic) — target 100% line coverage
2. `hermes_cli/` — target 90%+ line coverage
3. `agent/` — target 90%+ line coverage
4. `tools/` — target 85%+ line coverage
5. `gateway/` — target 85%+ line coverage
6. `tui_gateway/` — target 80%+ line coverage

**For each uncovered module:**
1. Identify uncovered functions/lines
2. Write unit tests
3. Re-run coverage
4. Commit

---

## Phase 5: E2E Testing

**Add Playwright-based e2e tests for:**
- CLI chat flow
- TUI startup and basic interaction
- Gateway endpoints
- Skill loading and execution
- Session management

**Integration with CI:**
- Add `e2e` job in `.github/workflows/tests.yml`
- Run on every PR
- Use Playwright's built-in CI mode

---

## Phase 6: WCAG 2.1 AAA Accessibility Testing

**For the web UI (`web/` directory):**

1. Install accessibility tools:
   - `playwright` with axe-core integration
   - `axe-core` for automated WCAG checks

2. Create accessibility test suite:
```python
# tests/a11y/test_wcag_aaa.py
import pytest
from playwright.sync_api import Page, expect
from axe-core-python import Axe

@pytest.fixture
def axe(page: Page):
    return Axe()

def test_wcag_aaa_contrast(page: Page, axe):
    """WCAG 2.1 AAA requires 7:1 contrast ratio for normal text."""
    page.goto("/")
    results = axe.run(page, tags=["wcag2aaa"])
    assert len(results["violations"]) == 0, f"WCAG violations: {results['violations']}"
```

**Target:**
- 0 WCAG 2.1 AAA violations on all public pages
- Color contrast ratios documented

---

## Phase 7: Pre-commit and Push Hooks

**Update `.pre-commit-config.yaml`:**

1. Add test run hook (runs fast subset):
```yaml
  - repo: local
    hooks:
      - id: run-tests
        name: Run fast tests
        entry: bash -c 'cd ~/repos/Hermes && source .venv/bin/activate && python -m pytest tests/ -m "not integration" -x -q'
        language: system
        pass_filenames: false
        stages: [push]
```

2. Add coverage enforcement hook:
```yaml
  - repo: local
    hooks:
      - id: coverage-check
        name: Enforce minimum coverage
        entry: python scripts/coverage_check.py --min-line=80 --min-branch=75
        language: system
        pass_filenames: false
        stages: [push]
```

3. Add e2e smoke test hook:
```yaml
  - repo: local
    hooks:
      - id: e2e-smoke
        name: E2E smoke tests
        entry: bash -c 'cd ~/repos/Hermes && source .venv/bin/activate && playwright test tests/e2e/smoke.spec.ts'
        language: system
        pass_filenames: false
        stages: [push]
```

**Update GitHub Actions (`tests.yml`):**
- Add `coverage` job with threshold enforcement
- Add `e2e` job
- Add `a11y` job
- Fail PR if any fail

---

## Phase 8: CI/CD Integration

**Update `.github/workflows/tests.yml`:**

1. Add coverage gate:
```yaml
coverage:
  runs-on: ubuntu-latest
  needs: test
  steps:
    - name: Check coverage thresholds
      run: |
        coverage-report --fail-under=80
```

2. Add e2e job:
```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - name: Install Playwright
      run: npx playwright install --with-deps
    - name: Run e2e tests
      run: npx playwright test
```

3. Add accessibility job:
```yaml
a11y:
  runs-on: ubuntu-latest
  steps:
    - name: Run axe-core accessibility tests
      run: pytest tests/a11y/ -v
```

---

## Phase 9: Documentation

**Create/update:**
- `CONTRIBUTING.md` — updated testing standards
- `docs/testing.md` — how to write tests, coverage requirements
- `docs/a11y.md` — accessibility compliance documentation

---

## Execution Strategy

1. **Phase 1-3:** Fix collection errors and establish clean lint baseline (can be done in parallel)
2. **Phase 4:** Systematic test coverage improvement (use parallel subagents)
3. **Phase 5-6:** E2E and accessibility testing
4. **Phase 7-8:** Hooks and CI integration
5. **Phase 9:** Documentation

**Commit strategy:** After each phase completion, commit with descriptive message.
