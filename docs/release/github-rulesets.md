# GitHub Repository Rulesets

Exported 2026-06-19. Verify with:

```bash
gh api repos/SimStm/lazy-nevis/rulesets
gh api repos/SimStm/lazy-nevis/rulesets/17911118
gh api repos/SimStm/lazy-nevis/rulesets/17911312
```

## Main branch (ID 17911118)

Target: default branch (`~DEFAULT_BRANCH`) — Enforcement: active

```json
{
  "id": 17911118,
  "name": "Main branch",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"]
      }
    }
  ],
  "bypass_actors": [
    { "actor_id": 7052502, "actor_type": "User", "bypass_mode": "always" }
  ]
}
```

### Verification against plan

| Requirement | Status |
|---|---|
| Pull request required | ✓ |
| 1 approval + code owner review | ✓ |
| Required thread resolution | ✓ |
| Squash-only merge | ✓ |
| No force push (`non_fast_forward`) | ✓ |
| No branch deletion | ✓ |
| Apply to administrators with limited bypass | ✓ owner only |
| Dismiss stale reviews on push | ✗ — set `dismiss_stale_reviews_on_push: true` |
| Required status checks | ✗ — not yet configured (see note below) |

**Pending — dismiss stale reviews:** Update the ruleset and set `dismiss_stale_reviews_on_push` to `true`. Without this, an approval granted before a new push remains valid.

**Pending — required status checks:** The plan requires these CI job names to be added as required checks:
- `Frontend quality`
- `Rust quality`
- `Repository policy`
- `PowerShell policy`
- `Dependency policy`
- `Smoke build (linux-x64)`
- `Smoke build (macos-arm64)`
- `Smoke build (windows-x64)`

GitHub only allows selecting a job name after it has been observed running on the repository at least once. Run the CI pipeline against a PR or push to main, then return to `Settings > Rules > Rulesets > Main branch` and add these checks.

## Version Tags (ID 17911312)

Target: `refs/tags/v*` — Enforcement: active

```json
{
  "id": 17911312,
  "name": "Version Tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/tags/v*"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "creation" },
    { "type": "update" }
  ],
  "bypass_actors": [
    { "actor_id": 7052502, "actor_type": "User", "bypass_mode": "always" }
  ]
}
```

### Verification against plan

| Requirement | Status |
|---|---|
| Target `v*` tags | ✓ |
| Block tag deletion | ✓ |
| Block tag updates | ✓ |
| Restrict tag creation to maintainer | ✓ (`creation` rule + owner bypass only) |
| Apply to administrators with limited bypass | ✓ owner only |

Tag ruleset is fully compliant with the plan.

## Remaining Actions

1. **Fix `dismiss_stale_reviews_on_push`:** In the GitHub UI, edit the Main branch ruleset and enable "Dismiss stale reviews on push."
2. **Add required status checks:** After CI has run at least once on this repository, return to the Main branch ruleset and add the eight job names listed above.
