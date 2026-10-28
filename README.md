# Meeter: free AI meeting copilot (Chrome extension)

Live transcription, a **real-time copilot that tells you what to say**, and Otter-style AI notes after every meeting.
It's a Chrome extension: **no server, no sign-up, no API key required.**

## How it works for the user

1. **Install**, and onboarding opens automatically (name, mic, free AI, your assistant account, how to use it).
2. On any meeting tab (Google Meet, Zoom web, Teams web…), **click the Meeter icon** or press **Alt+M**. The side panel
   opens. Press **Start listening**.
3. Get live suggestions in the panel, or tap **🪟 Float** for an always-on-top card you can park under your webcam.
4. Press **Stop**. Then **Open AI notes in the platform**, or **Continue in ChatGPT / Claude / Gemini**.
5. For anything deeper (library, search, uploads, ask across meetings, settings), click **Platform ↗**.

## The AI: free, and no keys

| Layer | What powers it | Cost |
|---|---|---|
| Live copilot + notes | **Chrome built-in AI** (Gemini Nano, on-device, via the Prompt API) | Free, private, no account |
| Your mic transcript | Browser speech recognition | Free |
| Deep analysis | **Your own logged-in ChatGPT, Claude or Gemini.** One click opens it with the meeting typed in; you press Enter. | Whatever plan you already have |
| Optional upgrades | API key: free Gemini / Groq, or OpenAI, Claude, Ollama | Free tiers available |

**Why the live copilot doesn't run on your ChatGPT, Claude or Gemini login:** those consumer subscriptions don't let
other apps use them. Driving their websites behind your back would break their terms and could get your account
flagged. So Meeter uses them the legitimate way, as a one-click handoff, and runs the live part on the free on-device
model.

**On-device AI requirements:** desktop Chrome 138+ with about 22 GB of free disk space and 16 GB RAM or a GPU with
more than 4 GB VRAM. The model downloads once during onboarding. On other machines, onboarding offers a free Gemini or
Groq key instead.

**The other side of the call:** tab audio is captured, but the on-device model can only transcribe it on Chrome builds
with audio input in the Prompt API. Otherwise add a free Gemini or Groq key (Settings → Transcription), or use
**speaker mode** (no headphones, so the mic hears everyone).

## Develop and install

```bash
npm install
npm run build      # → dist/ is the unpacked extension
npm run zip        # → meeter-extension.zip for the Chrome Web Store
npm run dev        # http://localhost:5173/app.html, the platform as a plain web app (no chrome.* features)
```

Load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`.

## Structure

```
public/manifest.json           MV3 manifest (side panel, tabCapture, content script, Alt+M)
src/extension/background.ts    opens onboarding on install; toolbar icon opens the side panel
src/extension/handoff-content.ts  types the meeting into ChatGPT / Claude / Gemini (never submits)
src/entries/*.tsx               page entries: app (platform), sidepanel, onboarding
src/sidepanel/SidePanel.tsx    quick-access surface: start on this tab, live copilot, done screen
src/onboarding/Onboarding.tsx  first-run flow
src/lib/useLiveEngine.ts       capture → transcribe → copilot → autosave (shared by panel + platform)
src/lib/builtin.ts             Chrome Prompt API wrapper (on-device Gemini Nano)
src/lib/ai.ts                  providers: builtin · Gemini · OpenAI · Claude · OpenAI-compatible
src/lib/handoff.ts             "Continue in…" prompts and tab opening
src/lib/audio.ts               mic, tab capture, display capture, VAD chunking, WAV encoding
```

Permissions: `sidePanel`, `tabCapture` + `activeTab` (call audio from the tab you're on, only after you click the
icon), `storage`, and a content script on chatgpt.com, claude.ai and gemini.google.com for the handoff. Meetings stay
in the extension's IndexedDB.

## Responsible use

Recording laws differ by place, and many require **everyone's consent**. Tell people you're using an AI notetaker.
Some interviews, exams and assessments prohibit live AI assistance; follow their rules.
