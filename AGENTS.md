# ReproClaw Agent Notes

## Nia Project Memory

This workspace is registered with Nia as a local folder source:

```text
a637b2fa-94e4-4742-a192-73a80ed15017
```

Use explicit local-folder scoping for codebase memory:

```powershell
& 'C:\Users\ayush\.bun\bin\nia.exe' search query "your question" --local-folders a637b2fa-94e4-4742-a192-73a80ed15017
```

The source has been synced once with:

```powershell
& 'C:\Users\ayush\.bun\bin\nia.exe' local sync a637b2fa-94e4-4742-a192-73a80ed15017
```

Before syncing again, keep `.env`, caches, virtualenvs, databases, and generated files ignored through `.gitignore` and `.niaignore`.

## Build Scope

Keep the MVP dependency-light:

1. FastAPI, Uvicorn, and HTTPX for the backend.
2. Python standard library for storage, parsing, fixtures, and scoring.
3. Plain HTML, CSS, and JavaScript for the dashboard.

Do not add frontend frameworks, queues, ORMs, PDF parsing, or sandbox execution unless the current task requires it.

