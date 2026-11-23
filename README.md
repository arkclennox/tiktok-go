# tiktok-go

An agent skill (Claude Code, OpenCode, Hermes, or any agent that reads `SKILL.md`) that makes **TikTok "location tag" promo videos for hotels, homestays and daily-rent apartments** — vertical 1080×1920, 35–42 s, in Indonesian.

Skill agen untuk membuat **video promo penginapan gaya "tag lokasi" TikTok** — vertikal, 35–42 detik, berbahasa Indonesia.

## What it makes

- Real photos of the property (from its Google Maps gallery, full resolution)
- An edit language that must change every video (enforced by `lint.py`): 15 transitions (whip, flash, light leak, zoom-through, spin, push, gravity drop, iris, slice, RGB glitch…), 11 camera moves (speed ramp, crash zoom, 3D dolly, measured handheld shake…), split / grid / polaroid layouts, 6 kinetic caption styles, word hits, title and price styles, colour looks and CC0 sound effects — vocabulary and the external sources behind it in [`references/gaya.md`](references/gaya.md)
- Voice-over where each sentence starts 0.3 s before the previous one ends (the fast "stacked" TikTok delivery)
- Rendered with [Remotion](https://www.remotion.dev/)

## Voice: use any TTS

Set `"tts"` in `script.json` — see [`references/tts.md`](references/tts.md):

| provider | |
|---|---|
| `elevenlabs` | word timestamps from ElevenLabs (default) |
| `openai` | OpenAI or any OpenAI-compatible `/v1/audio/speech` server (Kokoro, local servers…) |
| `voicestudio` | local VoiceStudio app |
| `command` | any CLI: macOS `say`, `edge-tts`, `piper`, `espeak-ng`… |
| `files` | your own recordings, one file per line |

Without provider timestamps, word timings come from `whisper-cli` (whisper.cpp) when available, otherwise from proportional alignment inside the detected speech.

## Built-in checks (before anything is rendered)

- `lint.py` — banned English loanwords (TTS mispronounces them), script too similar to earlier videos, an edit plan that repeats itself or the previous video, shots too short/long, photos that would be upscaled, title too wide, missing property name, invalid price format…
- `cek.mjs` — renders every shot at the start, middle and end of its camera move, plus the middle of every transition, layout entrance and word hit, into contact sheets so the agent inspects watermarks, wrong crops, faces, misread signage and caption overlap before the full render.
- `references/pelajaran.md` — a lessons log the agent must read first and append to after every correction, so mistakes are not repeated.

## Setup

```bash
git clone https://github.com/arkclennox/tiktok-go ~/.agents/skills/tiktok-go
~/.agents/skills/tiktok-go/scripts/setup.sh
```

Needs Node 18+, ffmpeg, [uv](https://docs.astral.sh/uv/). Optional: whisper.cpp (`whisper-cli`) for better word timing with non-ElevenLabs voices.
Link the folder into your agent's skills directory (e.g. `~/.claude/skills/tiktok-go`).

API keys are read from environment variables or from `.env` files listed in `~/.config/tiktok-go/config.json` (outside the repo). Nothing secret is stored in this repository.

## Workflow

See [`SKILL.md`](SKILL.md) (Indonesian). In short: pick the property → collect photos → write a new script → `lint.py` → `node vo.mjs` → `prep.py` → `node cek.mjs` + inspect → `node render.mjs` → `out/<property-name>.mp4` → log lessons.

## Notes

- Photos from Google Maps belong to their uploaders; get permission before publishing commercially. No photos are included here.
- Font: Montserrat (SIL Open Font License 1.1), downloaded by `setup.sh` from the official google/fonts repository.
- License: MIT.
