# Research

Prior-art surveys behind Macrotide's design decisions — what existed in the
wider ecosystem at a given moment, and what we took from it. Each survey's
**Decision** links to the feature doc where the *reasoning* lives; this folder
is the evidence ("what's out there"), not the verdict.

## Conventions

- **One topic per file**, kebab-named (`memory-systems.md`) — no numbering;
  these are dated surveys, not a decision ledger.
- **Each doc opens with** a `*Researched <month year>*` line, then `## Summary`
  and `## Decision` sections — the Decision links to the feature doc where its
  reasoning lives. No status fields to keep bumping; GitHub's outline handles
  navigation. Sub-aspects within the body use `###`.
- **Provenance goes at the end** — a short closing section (e.g.
  `## About this research`) on how the research was gathered (sources, method,
  date) and which claims are unverified. It matters most for AI-gathered research
  — the reader needs to know what was checked against a primary source. Cite
  source URLs inline.
- **Latest vs historical:** the un-suffixed file is current. To re-survey, freeze
  the old one as `<topic>-<YYYY-MM>.md`, add `> Superseded by <new file>` at its
  top, and never touch it again — leaving one current file plus dated archives.
