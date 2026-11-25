# 🦃 UncleSprite

**The paranoid Thanksgiving personal agent that lives in a Fly.io Sprite bunker.**

UncleSprite is a skeptical, security-obsessed "weird uncle" who runs inside a
hardware-isolated Fly.io Sprite. Before he touches anything he makes a backup.
He refuses to hold a single API key — every external call goes through a Sprites
Connector. And he never forgets a mistake: he keeps a grudge memory in Pinecone.

Built for [Hacksgiving 2026](https://fly.io/hacksgiving/) (Fly.io × TypeSafe AI).

---

## The problem

Personal agents that live on your laptop are a security and persistence
nightmare: they hold long-lived API keys, they forget everything on restart, and
you can't trust what they touch. UncleSprite is the opposite — a paranoid agent
in a disposable, persistent, hardware-isolated computer that never sees a secret.

## What it does (golden path)

```bash
unclesprite "review Alvinagustus/Unclesprite#1"
```

1. **Bunker Mode** — `sprite checkpoint create` snapshots the whole VM before
   any work ("I don't trust this.").
2. **Zero-Trust Rant** — scans the Sprite's environment and proves there are
   **zero provider API keys** inside; all access is via the Connector Gateway.
3. **GitHub (connector)** — fetches the real issue.
4. **Jev decision core (TypeSafe System One via OpenRouter connector)** — asks
   typed questions and gets calibrated answers:
   - `noul` — unresolved TODO/FIXME? security risk?
   - `score` — readiness 0–100
   - `choice` — category (vague / insecure / incomplete / ready)
5. **Grudge memory (Pinecone connector)** — recalls similar past mistakes and
   cites them ("Today you … I still have the note.").
6. **Verdict** — a deterministic Weird-uncle template voice + the typed Jev
   findings, posted as a GitHub comment.

Every run is deterministic-first: if OpenRouter or Pinecone is unavailable, a
local heuristic + template voice keeps the golden path alive.

## Architecture

```
unclesprite/
├── src/
│   ├── cli.ts         # arg parsing, orchestration, exit codes
│   ├── bunker.ts      # checkpoint + zero-trust env scan
│   ├── gateway.ts     # Sprites Connector Gateway caller (no keys in VM)
│   ├── connectors.ts  # GitHub + Pinecone typed wrappers
│   ├── jev.ts         # Jev (System One) decision core via OpenRouter
│   ├── embed.ts       # deterministic local text embedding (384-d)
│   ├── memory.ts      # grudge store/recall (Pinecone + local fallback)
│   ├── verdict.ts     # Jev decision + heuristic fallback
│   └── persona.ts     # Weird Uncle template bank (deterministic)
├── tests/             # node --test smoke + negative (red-to-green)
├── scripts/demo.sh    # one-command golden-path demo
├── scripts/deploy.sh  # push build into a Sprite
├── sprite.yaml        # Sprites deployment manifest (topology + connectors)
└── README.md
```

### Connectors (load-bearing)

| Connector | Role |
|---|---|
| **GitHub** | read issues, post the verdict comment — *hard dependency, no fallback* |
| **OpenRouter → Jev** (`typesafe/jev-1.14`) | typed decision core (noul/score/choice + confidence) |
| **Pinecone** | grudge memory (384-d cosine index) |

GitHub is a hard dependency: remove it and there is no task to review and no
verdict to post. OpenRouter (Jev) and Pinecone each have a deterministic local
fallback so the golden path still runs if they are down — but with them present
the agent makes *calibrated typed decisions* and *remembers across runs*, which
is the whole point. The fallback is a safety net, not the feature.

## Quick start

```bash
npm install
npm run build
npm test          # 8 tests, incl. negative (red) cases
```

Run inside a Sprite (see `scripts/demo.sh`):

```bash
export GITHUB_CONN_ID=...        # GitHub connector id
export OPENROUTER_CONN_ID=...    # OpenRouter (Jev) connector id
export PINECONE_CONN_ID=...      # Pinecone connector id (optional)
export SPRITE_NAME=unclesprite         # any Sprite name you created
bash scripts/demo.sh
```

## Demo

Run the offline golden path (no Sprite needed) to see the deterministic voice:

```bash
npm install && npm run build
node dist/src/cli.js demo
```

For the full connector-backed path, deploy to a Sprite and run `scripts/demo.sh`
(needs a Sprite + 3 connector IDs — see `sprite.yaml`). A recorded demo video is
linked in the Hacksgiving submission.

## Deploy to Sprites

See `sprite.yaml` for the full topology. Short version:

```bash
sprite create unclesprite               # one-time; use any name you like
./scripts/deploy.sh                     # push build into the Sprite
GITHUB_CONN_ID=... OPENROUTER_CONN_ID=... PINECONE_CONN_ID=... ./scripts/demo.sh
```

## Known limitations

- Grudge embedding is a deterministic hashing bag-of-words (no model call).
- Pinecone index must be a **legacy vector index** (384-d, cosine); the Sprites
  connector does not support the new document-schema indexes.
- Template voice is deterministic by design; no LLM is required for the omelan.

## Next steps

- Optional LLM voice via OpenRouter chat model (template stays as fallback).
- Slack / Box connectors for wider task intake.
- Host-side `demo.sh` already creates the checkpoint; agent-side checkpoint is a
  graceful no-op inside the VM.

## License

MIT — see [LICENSE](LICENSE).