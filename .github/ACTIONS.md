# GitHub Actions Ownership

The maintainer owns workflow updates. Third-party actions are pinned to full commit SHAs; the adjacent version comment is informational. Dependabot proposes monthly action updates, which require review of release notes and a passing fork-safe CI run. Workflows use explicit least-privilege permissions and never use `pull_request_target` to execute contributor code.
