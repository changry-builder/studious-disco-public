# Cockpit

Personal cockpit app. See `docs/PLAN.md` for the plan and `docs/workflows.html` for the workflow explainer.

Status: **M0 skeleton done.** Empty Today screen, one capture line, fake model, no real modules yet.

## Run it (two terminals)

Backend (Python 3.12+):

```
cd cockpit/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example ../.env        # optional; defaults work
uvicorn cockpit.core.app:app_factory --factory --port 8000
```

Web (Node 20+):

```
cd cockpit/web
npm install
npm run dev
```

Open http://localhost:5173. To see the phone layout on your phone, open `http://<laptop-ip>:5173` on the same Wi-Fi (the dev server already listens on the network). Plain HTTP means no install or push, which is expected for the prototype. Do not expose it beyond your home network: there is no sign-in yet.

## Test it

```
cd cockpit/backend && source .venv/bin/activate && pytest
cd cockpit/web && npm test && npm run build
```

## Notes
- The model is `fake` by default, so no API key and no tokens are used. The Claude model is wired in at M1.
- Database tables are created automatically in M0. Alembic migrations are introduced at the start of M1, when the first real schema exists.
- Secrets live only in `.env`, which is git-ignored.
