# Security Policy

## Supported versions

| Project | Supported |
| --- | --- |
| `slicejs-web-framework` | latest minor (`4.3.x`) |

Older `4.x` minors may receive fixes for critical issues at the maintainer's discretion. Upgrade to
the latest minor before reporting whenever possible.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

**Preferred:** GitHub private vulnerability reporting —
https://github.com/VKneider/slice.js/security/advisories/new

**Fallback:** `security@vkneider.dev` with `SECURITY` in the subject.

Please include:

- the affected `slicejs-web-framework` version
- a minimal reproduction (a clean `slice init` app is ideal)
- impact and attack surface
- any suggested fix
- whether you plan to disclose publicly

Do not include secrets, tokens or real user data in the report.

## What to expect

- We aim to acknowledge within 3 business days.
- We will triage severity and confirm next steps within 7 business days.
- Fix timing depends on severity; we will keep you informed.
- We will credit you unless you ask to stay anonymous.

## Scope

In scope:

- the browser runtime, router, lifecycle, events and context managers
- the server entrypoint, middleware order and SPA fallback
- native SEO/prerender handling and path decoding
- path handling, sanitization and production source-exposure guards
- the build/runtime contract enforced by the framework

Out of scope:

- vulnerabilities in third-party dependencies (report them upstream)
- demo applications, example content or a specific app's configuration
- social engineering
- volumetric denial of service
- issues that require compromised credentials or a compromised device

If you are unsure where a report belongs, report it privately and we will route it.

## Safe harbor

Good-faith research is welcome. Do not access data that is not yours, do not run destructive tests,
and give us reasonable time to fix the issue before public disclosure.

## Security practices

- Do not commit secrets, tokens or credentials.
- Keep dependencies up to date.
- Report suspected leaks or exposed configuration privately.
