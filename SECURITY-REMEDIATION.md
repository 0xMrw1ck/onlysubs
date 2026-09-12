# Security remediation report — 2026-09-12

## Result and scope
Source patches are applied locally in the development directory and Git checkout. These changes are not yet in the published 0.6.0 installer. This review is not an independent penetration test or a guarantee of complete vulnerability coverage.

Reviewed local HTTP routes, Electron process/renderer boundaries, subprocess execution, captions, file serving/deletion, settings, static-site configuration, package lock, release/build scripts, and GitHub alert state. No Dockerfile, Terraform, CloudFormation, or CI workflow is present in the tracked repository; weekly Dependabot configuration exists.

## Findings and remediation

### High — media-triggered network access (CWE-918)
FFmpeg/FFprobe previously accepted their default network protocols while parsing user-imported media. A playlist disguised with an accepted video extension could direct the decoder to HTTP endpoints, violating the local-processing boundary.
Fixed every probe, extraction, rendering, and concatenation input with an explicit file/pipe protocol whitelist. Normal local video editing and generated concatenation remain supported; network-referenced playlists intentionally no longer work.
Regression: real bundled FFprobe rejects a disguised playlist while a local HTTP server records zero requests.
Residual: local file references within complex media and native decoder vulnerabilities are not isolated by an OS sandbox. Restricting all external local references requires further format/sandbox design.

### Medium — downloads followed filesystem links (CWE-59)
Download serving trusted the recorded path and followed replaced file links or directory junctions. A local actor able to modify export directories could redirect the download to another readable file.
Fixed shared media serving to reject symbolic links, non-regular files, and realpath mismatches, including ancestor junctions.
Regression: junction-based redirection is denied; existing byte-range, download, and deletion tests pass.
Residual: a same-user local attacker can still race path validation and file opening. Strong handle-based filesystem isolation requires architectural review. Legitimate exports through junction paths will be rejected; regular folder selection and existing API signatures are unchanged.

### Low — malformed authentication header threw an exception
A 64-character non-ASCII header passed the character-length check but produced unequal byte lengths for timingSafeEqual.
Fixed by requiring the exact 64-character lowercase hexadecimal token format before constant-time comparison. Regression confirms rejection without an exception.

### Low — unterminated subprocess output accumulated in memory
The line parser retained an unbounded partial stdout line despite bounding total captured output.
Fixed by retaining at most 64 KiB of an incomplete line. Progress lines and existing output capture remain compatible.

## Dependency results and version guidance
- npm audit: zero reported vulnerabilities across the locked dependency graph (349 reported total).
- GitHub secret-scanning alerts: empty; Dependabot alerts: empty at query time.
- OSV batch: no advisories returned for faster-whisper 1.2.1, ctranslate2 4.8.2, av 18.1.0, onnxruntime 1.29.0, numpy 2.5.3, tokenizers 0.23.2.
- No CVE-driven upgrade with a verified fixed version was identified. Retain Electron 44.2.0, electron-updater 6.8.9, electron-builder 26.15.3, Vite 8.2.2, React/React DOM 18.3.1 for this patch; speculative major upgrades would conflict with compatibility requirements.
- FFmpeg build metadata reports 9.0.1. OSV/npm checks do not constitute a complete assessment of FFmpeg, its linked libraries, the embedded Python runtime, or every frozen transcriber dependency. An authoritative native SBOM and advisory review remain required.
- Rebuild native engines from an isolated, version- and hash-pinned environment before the next native dependency upgrade. Current build script relies on absolute developer-machine paths and ambient Python packages.

Sources: https://api.osv.dev/v1/querybatch ; https://registry.npmjs.org ; GitHub repository security APIs. Empty advisory results mean no matching reports returned, not proof of security.

## Secrets and OWASP coverage
A pattern scan of 46 tracked files found no matching private-key blocks, GitHub tokens, AWS access IDs, or OpenAI-style keys. No secret values were printed. This is not a full-history or entropy-based scan; rotate any independently known exposed credentials.
No SQL/database execution or raw HTML insertion was identified in the reviewed application paths. React text rendering and ASS text sanitization are present. API Host/Origin checks, per-launch desktop tokens, redirect rejection for Ollama, and shell-free subprocess arguments remain in place.
Development mode intentionally exposes settings for executable paths to trusted local API callers; it must never be deployed as a public server. Authenticated desktop access is not an OS sandbox against malicious programs running as the same user.

## Remaining manual/architectural work
1. Windows installer is unsigned and signature enforcement has not been established. Obtain a publisher signing identity, sign installers, and validate updater signature verification before claiming production readiness. Checksums alone do not protect against a compromised release account.
2. Add CI tests/security checks and main-branch protection; the screenshot showed main unprotected, and no remote protection change was made in this audit.
3. Independently audit native decoder dependencies, model-download provenance, and corresponding FFmpeg source distribution. Existing notices are not proof of complete licence compliance.
4. Clean-Windows installation, upgrade/rollback, first-model-download, accessibility, and full UI/end-to-end validation remain outside this patch's automated coverage.
5. Local jobs can consume substantial CPU/disk and imports may contend for disk space. Per-process resource limits and robust concurrent-upload admission need design work.
6. The old source repository remains public for update migration. Visibility changes do not remove copies already downloaded.
7. Policies still need confirmed operator, retention, and hosting details. No legal-compliance certification is made.

## Verification and release status
19 automated tests passed, including three new security regression tests. Vite production build passed. Source/API signatures and normal local-file workflows remain unchanged. No dependency lock changes, public release, repository visibility change, or user-media deletion was performed.
A rebuilt and tested Windows release is required to deliver these fixes to installed users.
