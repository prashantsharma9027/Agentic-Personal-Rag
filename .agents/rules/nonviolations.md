---
trigger: always_on
---

# Agent Rules & Development Guidelines

## Core Rules

- Never execute terminal commands automatically.
- Never install packages automatically.
- Never modify system files outside the project directory.
- Never delete files without explicit permission.
- Never overwrite important files without confirmation.
- Never use external APIs unless explicitly approved.
- Never add unnecessary dependencies.
- Never generate bloated code.
- Never create duplicate files or duplicate logic.
- Never hardcode secrets, tokens, or credentials.
- Never use telemetry, tracking, or analytics packages.

---

## Command Execution Policy

If commands are required:

1. Explain why the command is needed.
2. Provide commands one-by-one.
3. Wait for the user to execute them manually.

Example:

```bash
# Step 1
npm install

# Step 2
npm run dev