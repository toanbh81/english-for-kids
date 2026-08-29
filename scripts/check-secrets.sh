#!/usr/bin/env bash
# Secret-leak guard. Usage:
#   scripts/check-secrets.sh staged          # files staged for commit (pre-commit)
#   scripts/check-secrets.sh range A..B      # content added in commits A..B (pre-push)
#   scripts/check-secrets.sh tree            # every tracked file (manual audit)
# Exit 0 = clean, exit 1 = leak found (blocks the git operation).
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

mode="${1:-staged}"
fail=0
red() { printf '\033[31m%s\033[0m\n' "$*"; }

# 1) Forbidden files must never be committed (example files are fine).
forbidden_file='(^|/)\.env(\.[A-Za-z0-9_-]+)?$|(^|/)\.env\.local$|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|id_ed25519'
allowed_file='\.env\.example$'

case "$mode" in
  staged) files=$(git diff --cached --name-only --diff-filter=ACMR) ;;
  range)  files=$(git diff --name-only --diff-filter=ACMR "${2:?range required}") ;;
  tree)   files=$(git ls-files) ;;
  *) echo "unknown mode $mode"; exit 2 ;;
esac

while IFS= read -r f; do
  [ -z "$f" ] && continue
  if echo "$f" | grep -Eq "$forbidden_file" && ! echo "$f" | grep -Eq "$allowed_file"; then
    red "LEAK: secret-bearing file is being committed: $f"; fail=1
  fi
done <<< "$files"

# 2) Secret-looking content in added lines.
#    Each pattern is matched case-insensitively against '+' lines of the diff.
patterns=(
  'AZURE_SPEECH_KEY[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9]{20,}'   # Azure key with a real value
  'Ocp-Apim-Subscription-Key[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9]{20,}'
  '(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9_\-]{16,}'
  'sk-[A-Za-z0-9]{20,}'                       # OpenAI-style
  'ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
  'AKIA[0-9A-Z]{16}'                          # AWS access key id
  'xox[baprs]-[A-Za-z0-9-]{10,}'              # Slack
  '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
  'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'  # JWT
  # --- Supabase (Phase 11) -------------------------------------------------
  # Only the SERVICE ROLE key is a secret. The project URL and the anon /
  # publishable key are public by design (they ship inside the browser bundle)
  # and are exempted below — flagging them would train everyone to ignore this
  # gate, which is how the real key eventually gets waved through.
  'SUPABASE_SERVICE_ROLE(_KEY)?[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9._-]{16,}'
  'service[_-]?role([_-]?(key|secret))?[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9._-]{16,}'
  'sb_secret_[A-Za-z0-9_-]{8,}'               # current Supabase secret-key format
)

# Patterns that are matched WITHOUT the placeholder exemptions below, because
# nothing but a real key produces them.
# A legacy Supabase service-role key is a JWT whose payload encodes
# "service_role"; these are its base64 at each of the three byte alignments.
# The plain JWT rule already catches a bare one — this rule exists for the
# dangerous mix-up: a SERVICE key pasted into a variable *named* like the anon
# key, which the anon exemption would otherwise wave through.
# (The one-character brackets are deliberate: they keep each alternative from
# matching this very line, so the rule file stays scannable like any other.)
hard_patterns=(
  '(Nlcn[Z]pY2Vfcm9sZS|zZXJ2[a]WNlX3JvbGU|c2Vy[d]mljZV9yb2xl)'
  # A full-length `sb_secret_` key: long enough that no placeholder reaches it,
  # so not even the word "example" on the same line buys it a pass.
  'sb_secret_[A-Za-z0-9_-]{20,}'
)

# Lines that are clearly placeholders/docs are ignored.
#   …plus one deliberate exemption: an anon/publishable key ASSIGNED to an
#   anon/publishable-named variable. Those values are public, but the legacy
#   ones are JWT-shaped and would otherwise trip the JWT rule. The exemption is
#   the assignment shape, never a bare token, so a real secret cannot hide
#   behind the word "anon" in a comment.
ignore='your-key|<key>|<dán|REPLACE|example|placeholder|xxxx|\$\{?[A-Z_]+\}?$|process\.env|import\.meta\.env'
ignore="$ignore"'|(anon|publishable)_key[[:space:]]*[=:][[:space:]]*["'"'"']?(eyJ|sb_publishable_)'

case "$mode" in
  staged) diff_cmd="git diff --cached -U0 --diff-filter=ACMR" ;;
  range)  diff_cmd="git diff -U0 --diff-filter=ACMR $2" ;;
  tree)   diff_cmd="" ;;
esac

# Never echo the secret itself: keep the first 6 chars of any long token.
mask() { sed -E 's/([A-Za-z0-9_-]{6})[A-Za-z0-9_-]{10,}/\1********/g'; }

if [ -n "$diff_cmd" ]; then
  # Extract added lines with file names.
  added=$($diff_cmd | awk '
    /^\+\+\+ b\// { file=substr($0,7); next }
    /^\+/ && !/^\+\+\+/ { print file ": " substr($0,2) }')
  for p in "${patterns[@]}"; do
    hits=$(printf '%s\n' "$added" | grep -Ei -e "$p" | grep -Eiv "$ignore" || true)
    if [ -n "$hits" ]; then
      red "LEAK: possible secret in added lines (pattern: $p)"; echo "$hits" | head -5 | mask; fail=1
    fi
  done
  for p in "${hard_patterns[@]}"; do
    hits=$(printf '%s\n' "$added" | grep -Ei -e "$p" || true)
    if [ -n "$hits" ]; then
      red "LEAK: service-role key in added lines (pattern: $p)"; echo "$hits" | head -5 | mask; fail=1
    fi
  done
else
  # tree mode: scan file contents.
  for p in "${patterns[@]}"; do
    hits=$(echo "$files" | grep -Ev "$allowed_file" | xargs -r grep -EinH -e "$p" 2>/dev/null | grep -Eiv "$ignore" || true)
    if [ -n "$hits" ]; then
      red "LEAK: possible secret in tracked file (pattern: $p)"; echo "$hits" | head -5 | mask; fail=1
    fi
  done
  for p in "${hard_patterns[@]}"; do
    hits=$(echo "$files" | grep -Ev "$allowed_file" | xargs -r grep -EinH -e "$p" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      red "LEAK: service-role key in tracked file (pattern: $p)"; echo "$hits" | head -5 | mask; fail=1
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  red "Blocked: remove the secret (move it to server/.env, which is git-ignored) and try again."
  red "If this is a false positive, fix the pattern in scripts/check-secrets.sh rather than bypassing the hook."
  exit 1
fi
echo "check-secrets: clean ($mode)"
exit 0
