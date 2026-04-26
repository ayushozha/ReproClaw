# Nia Setup

The workspace is registered as a Nia local folder source.

```text
Local source ID: a637b2fa-94e4-4742-a192-73a80ed15017
Status: ready
Last sync: 29 items synced
```

Use explicit local-folder scope when asking Nia about this codebase:

```powershell
& 'C:\Users\ayush\.bun\bin\nia.exe' search query "Where is the static checker?" --local-folders a637b2fa-94e4-4742-a192-73a80ed15017
```

Refresh the index after meaningful file changes:

```powershell
& 'C:\Users\ayush\.bun\bin\nia.exe' local sync a637b2fa-94e4-4742-a192-73a80ed15017
```

`nia.json` is present for project intent, but this Nia CLI version currently reports the Windows local path as `needs_link` even after `nia local link`. The reliable path is the explicit `--local-folders` source ID above.

