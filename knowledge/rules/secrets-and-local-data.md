---
type: Playbook
title: Secrets and local data
description: Never commit secrets; preserve local-first privacy invariants.
tags: [agents, rules, security, privacy]
---

# Secrets and local data

- Do keep session titles, window titles, and history local unless the user explicitly exports.
- Do not add telemetry, accounts, or hidden outbound traffic. The only intentional outbound product path is the manual GitHub release check.
- Do not commit secrets, signing credentials, real env values, or personal demo profile data into the repo or `knowledge/`.
- Do not invent cloud sync or remote analytics without an explicit product decision recorded in OKF + OpenSpec.
- See also: `knowledge/product/capabilities/permissions-and-privacy.md`, `PRIVACY.md`
