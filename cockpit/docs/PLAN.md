# Cockpit: plan for sign-off

Status: **proposal, awaiting your approval. No application code exists yet.**
Version 0.1, 24 Oct 2026. The visual companion is `workflows.html` in this folder.

## 1. Questions that would change the plan

Each has a default. If you don't answer, the plan proceeds with the default.

| # | Question | Default I will use | Why it matters |
|---|----------|--------------------|----------------|
| 1 | Where should this live? This repo currently holds an unrelated geography game. | A new `cockpit/` folder here. A fresh repo is cleaner, and I recommend it if you are happy to create one. | Git history, branches and deploy settings stay clean. |
| 2 | May the prototype call the Claude API? Your typed lines would leave the laptop, and you need an API key (kept in `.env`, never committed). | Yes. Tests use a fake model, so they run offline and free. | The "agent" needs a model. The alternative is a local model (Ollama), which is slower and less accurate for date and name parsing. |
| 3 | What is your laptop OS, and do you have Python 3.12+ and Node 20+ installed? | Assume neither; I will write setup steps for your OS. | Two toolchains is the main beginner cost of this stack. |
| 4 | Which Android phone and Android version, which Galaxy Watch, and does Samsung Health already sync to Health Connect? | Android 14+, Galaxy Watch 4 or newer, sync not yet enabled. | Decides how hard Phase 3 is. |
| 5 | Which email account: personal Gmail, Google Workspace, Outlook? | Personal Gmail. | Gmail's read-only permission has extra friction for personal apps (see risks). |
| 6 | How should the morning summary reach you eventually, and when? | 07:30 local time, phone notification, with the same text in the app. | Drives the push choice later. |
| 7 | CRM and health data is sensitive. Is an unencrypted SQLite file on a disk-encrypted laptop acceptable for the prototype? Do you have existing data to import (contacts CSV, current to-dos)? | Yes, no import at first. | Import is a separate small task. Encryption changes the storage layer. |
| 8 | Confirmation policy for writes to your own data (adding a task, checking a habit). | Save immediately and show Undo for 30 seconds. Only send, delete, or spend asks first. | A confirm step on every capture would break the 5-second goal. |

Assumed without asking: habits are daily yes/no with optional weekly targets, one user, one time zone, English only.

## 2. Tech stack

**Recommendation for the prototype**

| Layer | Choice | Reason |
|-------|--------|--------|
| Backend | Python 3.12, FastAPI | Matches your hypothesis. Typed request and response models, automatic API docs at `/docs`, easy to test. |
| Validation | Pydantic | The same schemas validate API input and the agent's tool-call arguments. |
| Storage | SQLite through SQLAlchemy 2.0, behind a `Storage` interface | One file, no server. SQLAlchemy lets the same code move to Postgres by changing a connection string. |
| Migrations | Alembic | Schema changes are versioned files, so the database can evolve without losing data. |
| Scheduler | APScheduler (in-process) | Runs reminders and the morning brief while the app is running. A real always-on scheduler comes with deployment. |
| Agent | Claude API with tool calling, behind an `LLM` interface | One model call picks the module and fills its fields. A fast model keeps capture under a few seconds. |
| Front end | React + Vite + TypeScript, built as a responsive PWA | Separate from the backend by a JSON API. Large ecosystem and good tooling for a beginner. |
| Tests | pytest (backend, per module), Vitest (front end), Playwright for 2 to 3 end-to-end flows | Playwright is already available in this environment. |

**Is the hypothesis right?** Mostly yes. A Python backend plus PWA is the best prototype path. Three limits you should know about:

1. **A PWA cannot read Health Connect.** Health Connect is on-device only with no web API. Phase 3 needs a small native Android component (section 12).
2. **A phone on the same Wi-Fi is a plain-HTTP connection**, which is not a secure context. You can judge layout and speed, but installing the PWA, service workers and push will not work until it is served over HTTPS. The prototype is for judging the experience, not the install.
3. **Push on Android PWAs works** (Web Push in Chrome) once deployed, so a morning notification does not force a native app.

**Alternatives considered**

| Option | Good | Why not now |
|--------|------|-------------|
| HTMX + server-rendered pages | One toolchain, very simple | Blurs the UI and backend boundary you asked for, and is harder to wrap for Android later. |
| Svelte or Vue instead of React | Smaller, gentler | Fine choice. React wins on tutorials and AI-assisted help. |
| Flutter (one codebase for Android and desktop) | Real Android app, Health Connect plugins exist | New language, slower to iterate on chat-style UI, and discards the Python and web path. Worth revisiting at the deploy gate. |
| Native Kotlin app only | Best for Health Connect | Does nothing for the laptop. Use it only for the Phase 3 companion. |
| Local-first / CRDT sync from day one | Offline and multi-device by design | Large complexity for a prototype. Deferred to the sync decision. |

## 3. Repo and folder structure

```
cockpit/
  README.md                  how to run, how to test
  .env.example               names of settings, no values
  .gitignore                 .env, *.db, secrets/, node_modules/
  docs/
    PLAN.md  workflows.html  decisions/   one short note per decision
  backend/
    pyproject.toml
    cockpit/
      core/
        app.py               creates the FastAPI app, loads modules
        config.py            reads settings from environment
        registry.py          discovers modules, collects their tools
        agent.py             builds the model request, runs the tool loop
        router.py            POST /api/messages
        gate.py              confirmation gate and undo log
        scheduler.py         reminders and morning brief
        llm/                 interface.py, claude.py, fake.py
        storage/             interface.py, sqlite.py
      modules/
        actions/  habits/  crm/  home/      one folder per module
        email/    health/                   later phases
          manifest.py        name, tools, today(), reminders()
          models.py          tables
          service.py         the logic
          api.py             module's own routes
          tests/
    tests/                   core tests only
  web/
    src/
      app/                   shell, routing, theme
      features/today/  features/capture/    per-module screens
      layouts/phone/  layouts/laptop/       device-specific layouts
      api/                   typed client, the only code that calls the backend
  android/                   placeholder README for Phase 3, empty in the prototype
```

Rule: a module may import from `core` interfaces. It never imports another module. Modules talk through the registry (for example, the email module asks the registry for `actions.add_item`).

## 4. Module boundaries and interfaces

Every module exposes the same small contract in `manifest.py`:

```python
class Module(Protocol):
    name: str
    def tools(self) -> list[ToolSpec]: ...        # what the agent may call
    def today(self, ctx: Context) -> list[TodayItem]: ...
    def reminders(self, ctx: Context, window: timedelta) -> list[Reminder]: ...
    def routes(self) -> APIRouter: ...             # module's own HTTP routes
    def migrations(self) -> str: ...               # path to its Alembic branch
```

A `ToolSpec` has a name (`actions.add_item`), a description the model reads, a Pydantic argument schema, an `effect` and a handler.
`effect` is one of `read`, `write_local`, `destructive`, `external_send`, `spend`. The gate in `core/gate.py` enforces the policy from the effect, not from the module's own judgement.

`Storage` interface (core):

```python
class Storage(Protocol):
    def session(self) -> ContextManager[Session]: ...
    def run_migrations(self) -> None: ...
```

Modules receive a session from core and never open the database themselves, so swapping SQLite for Postgres touches one file.

Adding a module means: create the folder, implement the contract, add one line to the module list in config. Nothing in core changes.

## 5. Data model (smallest useful version)

All ids are UUIDs, so rows can be merged across devices later. Every table has `created_at`, `updated_at`.

**Core**
- `message_log(id, text, received_at, device, outcome, tool_calls_json)` raw input is always kept.
- `undo_log(id, message_id, module, inverse_json, expires_at)`
- `pending_confirmation(id, tool, args_json, status, created_at)`
- `reminder(id, module, ref_id, rule, next_fire_at, status)`
- `brief(date, text, data_json)`
- `setting(key, value)`

**actions**
- `action_item(id, title, notes, due_date, status[open|done|dropped], completed_at, needs_review, source_message_id)`

**habits**
- `habit(id, name, target_per_week, archived)`
- `habit_checkin(id, habit_id, day, note)` unique on `(habit_id, day)`
- Streaks and trends are computed from check-ins, never stored.

**crm**
- `contact(id, name, how_met, employer, phone, email, notes)`
- `contact_link(from_id, to_id, kind)` e.g. sister of
- `contact_interest(contact_id, text)`
- `contact_event(id, contact_id, kind[birthday|anniversary], month, day, year_nullable)`
- `gift_idea(id, contact_id, idea, url, price, status[idea|bought|given], occasion)`
- `contact_note(id, contact_id, text, source_message_id)` keeps the original wording.

**home**
- `home_item(id, name, area)`
- `maintenance_task(id, item_id, title, every_n_days, last_done, next_due)`
- `warranty(id, item_id, expires_on, notes)`
- `renewal(id, title, due_on, cost_estimate, notes)`

**email (Phase 2)**
- `email_triage(thread_id, sender, subject, snippet, needs_reply, reason, status[new|snoozed|dismissed|tasked])`. No full bodies stored.

**health (Phase 3)**
- `health_sample(id, metric, taken_at, value, unit, source)`
- `run_plan(day, kind, distance_km, notes)`, `run_actual(id, started_at, distance_km, duration_s, source)`
- `med_log(day, taken_at)`

## 6. How the agent routes a message

1. The UI sends `POST /api/messages` with the text, device and time zone.
2. Core saves the raw line to `message_log` first, so a crash or model failure never loses it.
3. The registry collects every module's `tools()` and builds one model request: instructions, today's date and weekday, your time zone, the tool list.
4. The model replies with a tool call (name plus arguments), a short clarifying question, or plain text for chit-chat. No separate classifier step.
5. Core validates the arguments with the tool's Pydantic schema and checks dates in code (the model proposes `2026-10-30`, code rejects impossible values).
6. The gate looks at `effect`. `write_local` runs now and logs an undo. `destructive`, `external_send` and `spend` create a `pending_confirmation` and wait for your explicit tap.
7. The module's handler runs, the reply card goes back to the UI.
8. If the model is unreachable or times out (8 s), the line is saved as an action item flagged `needs_review`. Capture never fails.
9. The loop allows up to 3 tool calls in a turn (for example, look up a contact, then update it).

Speed target for the 5-second goal: the input accepts the next line immediately; the result card appears when the model answers (aim for 1 to 3 seconds with a small, fast model).

Tests: each module has a table of example phrases and the tool call it should produce, run against the fake model for speed and against the real model on demand.

## 7. Safety rules, written into code

- Email and calendar start read-only. The `email` module registers no send tool at all. Drafts, when added, use a separate permission and can only create drafts.
- Anything with effect `destructive`, `external_send` or `spend` needs a confirm tap, in every device layout.
- Secrets live in `.env` (ignored by Git) and are read in `core/config.py`. `.env.example` lists names only. A pre-commit check blocks commits containing key-shaped strings.
- The agent never gets raw database access, only the module tools.

## 8. UI per device

| | Phone | Laptop |
|---|---|---|
| Home | Today: one column, check-off rows, big input pinned to the bottom | Today in the center, with side panels for Contacts, Habits trend, Home calendar |
| Capture | Autofocus single line, Enter to send, result chip with Undo | Same input as a command bar (keyboard shortcut) |
| Review | Short lists, swipe or tap to complete | Tables, search, bulk edit, merge duplicate contacts, charts |
| Not on phone | Bulk editing, wide tables | |

One codebase, two layouts under `web/src/layouts/`, chosen by screen width. Feature code is shared.

## 9. Milestones for the prototype

Each milestone is one Git branch and ends with a demo you can run.

| # | Milestone | "Done" means |
|---|-----------|--------------|
| M0 | Skeleton | `pytest` passes. `GET /health` works. The web page loads and shows an empty Today. The fake model answers a canned message. Git workflow practiced on a trivial change. |
| M1 | Action items | Typing `call plumber Friday` shows a card "Call plumber, due Fri 30 Oct" and an item in Today. `done plumber` completes it. 10 scripted phrases pass on the fake model, and at least 9 of 10 on the real model. Capture to saved card is under 5 seconds on your laptop. Layout reviewed at phone and laptop width. |
| M2 | Habits | Check-in by typing (`ran today`) or tapping in Today. Streak and 30-day trend correct against a hand-made test set. Habits and action items share one Today screen. |
| M3 | Personal CRM | A pasted note produces the right fields for 8 of 10 sample notes. Duplicates are detected. A birthday shows a reminder 14 days ahead in Today (dry run, no notification). Laptop contact table with search works. |
| M4 | Home maintenance | Recurring task completes and reschedules itself. A warranty and a renewal appear 30 days ahead. |
| M5 | Review and morning brief | Morning brief builds from all four modules on demand and on the local schedule. You use it for one week and write down what annoyed you. |

Phase 2 (email) and Phase 3 (health) begin only after the deploy decision below, because both need HTTPS and stored tokens or a companion app.

## 10. Git, in small steps

- One branch per module: `module/actions`, `module/habits`, and so on.
- Commit after each small working step, for example "add action_item table" then "add add_item tool".
- Each time you do something new in Git I will explain the command in a sentence first (branch, commit, push, merge request).
- `main` always runs. A module merges only when its tests pass and you have seen the demo.

## 11. Ready-to-deploy checklist

Decide on hosting and sync only when all are true:

- [ ] M1 to M4 done, and you have used Today daily for at least two weeks.
- [ ] You can name the modules you actually use. Unused ones are cut, not deployed.
- [ ] Capture feels fast and rarely misroutes (under 1 wrong route in 20 over the last week).
- [ ] You know which device you reach for in each situation, so sync requirements are concrete.
- [ ] Backup and restore of the SQLite file has been tried once.
- [ ] Every secret is read from environment settings. `git grep` finds none in the repo.
- [ ] You can state what happens if the phone has no signal when you capture.
- [ ] You have a monthly budget for hosting and model usage.

## 12. Deployment options to evaluate later (not decided)

| Topic | Options to compare |
|-------|--------------------|
| Hosting | Home machine or Raspberry Pi with Tailscale. Small VPS (Hetzner, Fly.io, Railway). Managed container platform (Cloud Run). |
| Database | SQLite on one server with continuous backup (Litestream). Managed Postgres (Neon, Supabase). |
| Sync | Server as the single source of truth plus an offline queue on the phone. Local-first sync engines (PowerSync, ElectricSQL, Automerge). |
| Auth | Private network only (Tailscale). Passkeys (WebAuthn). Google sign-in. Cloudflare Access in front. |
| Push and morning brief | Web Push from the PWA. ntfy or Telegram bot. Email. |
| Android packaging | Installed PWA. Trusted Web Activity. Capacitor wrapper. Kotlin shell. |
| Secrets | Host environment variables, host secret manager, SOPS-encrypted file. |

## 13. Risks and unknowns

| Risk | Detail | Plan |
|------|--------|------|
| Samsung data access | Health Connect has no cloud API, so reading it needs an Android app on the phone with user-granted permissions. Which metrics appear (sleep stages, HRV, skin temperature) depends on watch model and Samsung Health sync settings. | Native piece flagged for Phase 3: a small Kotlin companion that reads Health Connect and sends samples to the backend. Verify the metric list on your watch early with a free Health Connect viewer app. |
| Gmail permission | Read-only Gmail access is a restricted scope. A personal app left in Google's "testing" mode may issue refresh tokens that expire after about 7 days. | Evaluate at Phase 2: testing mode with re-consent, IMAP app password, or app verification. Check current Google rules then. |
| Privacy of email and CRM text | Content sent to a model provider leaves your machine. | Send only minimal fields (sender, subject, snippet). Allow and block lists for senders. Decision recorded in `docs/decisions/`. |
| Model mistakes | Wrong date, wrong contact, merged duplicates. | Validation in code, visible result card, Undo, raw text always saved, test table of phrases. |
| Latency | Under 5 seconds depends on model speed and network. | Small fast model, UI accepts next line immediately, fallback save. Measure in M1. |
| Local to deployed | See the list below. | Interfaces in section 4 keep each change local to one file. |
| Scope creep | Six modules is a lot. | Smallest version each, and the deploy checklist asks which modules you use. |
| Beginner load | Two toolchains plus Git. | Setup written per OS, small steps, explanations as we go. |

**What changes when moving from local to deployed**
1. HTTPS everywhere. The installable PWA, service worker and push only work over HTTPS.
2. Authentication. The prototype has none and must not be exposed to the internet.
3. The scheduler must run 24/7 on the server, not only while the laptop is open.
4. SQLite file becomes a backed-up database, possibly Postgres.
5. Secrets move from `.env` to the host's secret store.
6. Sync and offline capture on the phone.
7. Time zone and date handling moves from the laptop's clock to explicit settings.
8. CORS, rate limits and logging with no personal text in logs.
9. OAuth redirect addresses change from localhost to the real domain.

## 14. Keeping the explainer current

`workflows.html` is part of the repo. Any change to a workflow, interface or milestone updates it in the same commit, and its version line at the top changes with it.
