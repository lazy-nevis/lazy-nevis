# Windows SmartScreen

Stable releases should carry a timestamped Authenticode signature. Unsigned RCs or new certificates may trigger SmartScreen reputation warnings. Verify the GitHub release checksum, inspect Properties > Digital Signatures or `Get-AuthenticodeSignature`, and install only when release notes match the signature status. LazyNevis never asks users to disable SmartScreen or execution policy.
