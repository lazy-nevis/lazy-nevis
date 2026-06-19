#!/bin/sh
set -eu

fail=0
tracked_or_present() {
  find . -type f \
    ! -path './.git/*' ! -path './node_modules/*' ! -path './src-tauri/target/*' ! -path './dist/*' "$@"
}

for file in $(tracked_or_present \( -name '*.p12' -o -name '*.pfx' -o -name '*.mobileprovision' -o -name '*.provisionprofile' -o -name '*.db' -o -name '*.sqlite' -o -name '*.log' \)); do
  printf 'Forbidden local/release file: %s\n' "$file" >&2; fail=1
done

if command -v rg >/dev/null 2>&1; then
  secret_matches=$(rg -n --hidden -g '!.git/**' -g '!node_modules/**' -g '!src-tauri/target/**' -g '!bun.lock' \
    -e 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
    -e 'ghp_[A-Za-z0-9]{20,}' -e 'github_pat_[A-Za-z0-9_]+' \
    -e 'AKIA[0-9A-Z]{16}' . || true)
else
  secret_matches=$(grep -RInE \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target --exclude=bun.lock \
    'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|AKIA[0-9A-Z]{16}' . || true)
fi
if [ -n "$secret_matches" ]; then
  printf '%s\n' "$secret_matches"
  printf 'Potential secret material found.\n' >&2; fail=1
fi

large=$(tracked_or_present -size +10M -print)
if [ -n "$large" ]; then printf 'Files larger than 10 MiB require review:\n%s\n' "$large" >&2; fail=1; fi
exit "$fail"
