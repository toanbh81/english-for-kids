# Speak Up! — project rules

## Secrets (MANDATORY)
- Azure Speech key/region live ONLY in `server/.env` (git-ignored). Never put them in client code, docs, tests, commit messages or chat output.
- Before every `git commit` and `git push`, the secret scanner must run and pass: `bash scripts/check-secrets.sh staged` (commit) / `range <base>..HEAD` (push). It is wired as git hooks in `.githooks/` (`git config core.hooksPath .githooks` — run this once after cloning) and as a Claude Code PreToolUse hook in `.claude/settings.json`.
- Never bypass the hooks (`--no-verify`, `disableAllHooks`). If the scanner false-positives, fix the pattern in `scripts/check-secrets.sh` instead.
- Full audit of tracked files: `bash scripts/check-secrets.sh tree`.

## Commands
- `pnpm dev` (client https://localhost:5173 + server :8787), `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
