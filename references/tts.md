# Pilihan suara (VO) — `script.json` → `"tts"`

`vo.mjs` membuat suara per kalimat, menyusunnya saling tumpang (`overlap`, default 0,3 s), dan menulis waktu tiap kata ke `src/words.json`.
Gaya video sama untuk semua penyedia; yang berbeda hanya suara dan cara mendapatkan waktu kata.

| provider | butuh | waktu kata | catatan |
|---|---|---|---|
| `elevenlabs` | `ELEVENLABS_API_KEY` | dari ElevenLabs (paling akurat) | default; suara Cahaya `iWydkXKoiVtvdn4vLKp9` cocok untuk bahasa Indonesia |
| `openai` | `OPENAI_API_KEY` (atau `keyEnv` lain / `null`) | whisper → bagi rata | juga untuk server lain yang kompatibel OpenAI (`baseUrl`) |
| `voicestudio` | aplikasi VoiceStudio terbuka di perangkat yang sama | whisper → bagi rata | lokal, gratis; tanyakan pemilik sebelum membuka aplikasinya |
| `command` | program TTS apa pun di PATH | whisper → bagi rata | `say` (macOS), `edge-tts`, `piper`, `espeak-ng`, … |
| `files` | rekaman sendiri `voice/rekaman/s01.wav …` | whisper → bagi rata | satu berkas per baris naskah, urut |

## Contoh

```json
"tts": { "provider": "elevenlabs", "voiceId": "iWydkXKoiVtvdn4vLKp9", "modelId": "eleven_multilingual_v2",
         "voiceSettings": { "stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "speed": 1.2, "use_speaker_boost": true } }

"tts": { "provider": "openai", "model": "gpt-4o-mini-tts", "voice": "nova",
         "instructions": "Bahasa Indonesia, santai, ceria seperti pembuat konten TikTok" }

"tts": { "provider": "openai", "baseUrl": "http://127.0.0.1:8880/v1", "keyEnv": null, "model": "kokoro", "voice": "af_bella" }

"tts": { "provider": "voicestudio", "profileId": "<id profil dari GET /v1/audio/voices>" }
"tts": { "provider": "voicestudio", "instruct": "female, young adult, cheerful" }

"tts": { "provider": "command", "command": ["say", "-v", "Damayanti", "-r", "200", "-o", "{out}.aiff", "{text}"], "outputExt": "aiff" }
"tts": { "provider": "command", "command": ["edge-tts", "--voice", "id-ID-GadisNeural", "--text", "{text}", "--write-media", "{out}.mp3"], "outputExt": "mp3" }

"tts": { "provider": "files", "dir": "voice/rekaman" }
```

Placeholder untuk `command`: `{text}` (kalimat), `{out}` (path tanpa ekstensi — tulis ke `{out}.<outputExt>`), `{lang}`.

## Waktu kata (`"align"` di script.json)

- `"auto"` (default): pakai waktu dari penyedia kalau ada; kalau tidak, `whisper-cli` (whisper.cpp) bila terpasang dan modelnya diatur; kalau tidak, bagi rata menurut panjang kata di dalam rentang suara (deteksi hening).
- `"whisper"`: wajib whisper (gagal kalau tidak ada). `"proportional"`: selalu bagi rata.
- Whisper hanya dipakai untuk memetakan waktu; teks caption tetap dari naskah, jadi salah dengar whisper tidak merusak caption.
- Selain ElevenLabs: periksa sinkron caption di `out/cek-shot-*.jpg` (kata oranye = kata yang sedang diucapkan) dan dengarkan hasilnya.

## Pengaturan lokal — `~/.config/tiktok-go/config.json` (di luar repo, jangan di-commit)

```json
{
  "envFiles": ["~/.config/some-app/.env"],
  "chrome": "/path/ke/chrome-headless-shell",
  "whisperBin": "whisper-cli",
  "whisperModel": "~/models/ggml-large-v3-turbo-q5_0.bin"
}
```

Kunci dibaca dari env lebih dulu, lalu dari baris `NAMA=nilai` di berkas `envFiles`. Kunci tidak pernah dicetak, disimpan di proyek, atau di-commit.
Ganti penyedia = suara berubah = durasi berubah: jalankan `lint.py` lagi (durasi shot) dan `cek.mjs` sebelum render.
