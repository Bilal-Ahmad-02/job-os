# Backing up and restoring Oracle

Oracle's source repository is https://github.com/Bilal-Ahmad-02/job-os.
GitHub stores only files that have been committed and pushed. Editing a local file does not
automatically back it up. After each tested milestone, review the changes, commit the intended
source files, and push `main`. Confirm the remote commit matches the local one:

```powershell
git status --short
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

The last two commands should show the same commit hash. Before committing, inspect
`git diff --cached --stat` and `git diff --cached`. Never force-push as a backup procedure.
Lockfiles, source, tests, icons, and setup documentation belong in Git. Build artifacts,
installed dependencies, password hashes, `.env` files, API keys, local models, and personal
documents do not. `.gitignore` helps prevent accidents; it does not inspect file contents or
remove secrets from existing Git history.

## Restore after losing a computer

1. Sign in to the GitHub account that owns the repository. Keep GitHub recovery codes somewhere
   independent of the computer, such as your password manager's recovery kit.
2. Install Git and clone the repository:

   ```powershell
   git clone https://github.com/Bilal-Ahmad-02/job-os.git
   Set-Location job-os
   ```

3. Follow `README.md` for Python and `docs/DESKTOP.md` for the Windows/Node/Rust prerequisites.
   Use the committed dependency lockfiles, run the checks, and build the desktop executable.
4. Launch Oracle and create a new local Oracle password on the replacement computer.

The Windows executable can be rebuilt from source. GitHub does not preserve the installed
Python environment, compiler, Windows runtime, or current executable in this repository.

## Personal data is a separate backup

There is no job database or document store yet. This source backup therefore covers the current
application work, but **will not back up future jobs, CVs, credentials, AI conversation history,
or local settings**. Before adding those features, implement an encrypted, versioned off-device
data backup and test restoration. A sync folder alone is insufficient protection against accidental
deletion or corruption. Oracle's access password currently locks the app; it does not encrypt files.

The local password hash is stored at `%LOCALAPPDATA%\local.oracle.desktop\password.phc`, outside
the repository. Keep the password in your password manager. Never upload the hash to GitHub.
There is no automatic sync, scheduled push, or cloud data service configured by this milestone.
