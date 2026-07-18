# Session logs

One file per working session (chat session, pairing session, solo sprint —
any unit of work worth remembering). These are HISTORY, not state: the rest
of `docs/` describes how the project IS; this directory records how it got
there, session by session.

## Convention

- Filename: `YYYY-MM-DD-<short-slug>.md` (date the session happened).
- Keep each log short — a page or less. Link to commits, docs sections, and
  files instead of restating them.
- Sections (use what applies, skip what doesn't):
  - **Task** — what was asked, in a sentence or two.
  - **What changed** — files/commits, the shape of the change.
  - **Verification** — what was run/rendered/audited and what it showed.
  - **Decisions** — judgment calls made and why (mirror durable ones into
    the README decisions log; the session log keeps the full context).
  - **Follow-ups** — anything deferred, with enough context to pick up.
- Write the log at the END of a session that changed the repo. Doc-only or
  exploratory sessions are worth logging only if they produced a decision.
