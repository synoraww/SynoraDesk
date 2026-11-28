# Contributing to SynoraDesk

Thank you for your interest in contributing to SynoraDesk.

## Prerequisites

Because SynoraDesk currently uses Windows-specific APIs (Windows DPAPI, Windows Registry diagnostics, and Edge WebView2), active development and full builds must be performed on **Windows (x64)**:

- **Go:** 1.23+ (module targets Go 1.26)
- **Node.js:** 24+ (with `npm`)
- **Wails CLI v2:** `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Microsoft Edge WebView2 Runtime**

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for full environment setup and build instructions.

## Getting Started

1. **Fork** the repository on GitHub (`synoraww/SynoraDesk`).
2. **Clone** your fork locally:
   ```powershell
   git clone https://github.com/<your-username>/SynoraDesk.git
   cd SynoraDesk
   ```
3. **Install dependencies:**
   ```powershell
   go mod download
   cd frontend && npm ci && cd ..
   ```

## Branching Workflow

Create a dedicated branch from `main` for each change:

- `feat/<short-description>` — new features or enhancements
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation updates
- `refactor/<short-description>` — code refactoring without behavior changes

## Commit Conventions

Use clear, concise [Conventional Commits](https://www.conventionalcommits.org/) messages:

```text
<type>(<optional-scope>): <short summary>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `security`.

## Pre-Submission Checks

Before opening a Pull Request, ensure all checks pass locally:

1. **Frontend typecheck and build:**
   ```powershell
   cd frontend
   npm run build
   ```
2. **Backend Go unit tests:**
   ```powershell
   go test -v ./...
   ```
3. **Full Wails desktop build (recommended):**
   ```powershell
   wails build -platform windows/amd64 -s
   ```

## Pull Request Process

1. Keep PRs focused on a single concern or issue.
2. Update relevant documentation if you change behavior, configuration, or commands.
3. Describe what changed, why it was needed, and how you tested it in the PR description.
4. Ensure CI workflows (`.github/workflows/ci.yml`) pass on your branch.
