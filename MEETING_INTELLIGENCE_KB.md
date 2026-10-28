# Meeting Intelligence — Knowledge Base

> Reference for the **meeter** project. Compiled 2026-10-27.
> **Confidence tags:** ✅ = confirmed by 2026 reporting found during research · 🟡 = background knowledge (pre-mid-2026) or a single source; verify before relying on it.
> Prices change constantly; treat every price here as a ballpark and check the vendor page.

---

## 1. What "meeting intelligence" means

Software that **captures** conversations (virtual, phone, in-person), **transcribes** them, and **turns them into structured, actionable knowledge**: summaries, action items, decisions, CRM updates, coaching, analytics, searchable memory, and increasingly **agents that act** on what was said.

### The value stack (each layer is a product category and a moat)
| Layer | What it does | Who's strong |
|---|---|---|
| 1. Capture | Bot joins call / local device audio / hardware / phone | Recall.ai (infra), Granola (bot-free), Plaud (hardware) |
| 2. Transcription (ASR) | Speech → text, speaker diarization, multilingual | Deepgram, AssemblyAI, Speechmatics, ElevenLabs Scribe, OpenAI, Whisper |
| 3. Understanding (LLM) | Summaries, action items, decisions, sentiment, topics | Everyone (commoditized) |
| 4. Workflow | CRM sync, tasks, follow-up emails, Slack/Notion push | Fireflies, Avoma, Momentum, Attention |
| 5. Cross-meeting memory | Search/chat across all meetings, deal/project history | Granola Spaces, Fireflies "Talk to Fireflies", Read.ai, Gong |
| 6. Analytics & coaching | Talk ratio, objections, deal risk, rep scoring, forecasting | Gong, Clari, Chorus |
| 7. Agents / actions | Agents that do follow-up work, plus MCP/API so other AIs can use meeting context | Gong (Agent Studio, MCP), Granola APIs, Superhuman Go + Fathom |

**Key insight:** layers 2–3 are commoditized. The money and the defensibility sit in **capture UX (bot-free), cross-meeting memory, workflow integrations, and agents**.

---

## 2. Market map: the world's leading tools

### 2A. General AI notetakers (horizontal, prosumer → team)

| Tool | HQ | Capture | Known for | Price ballpark | Notes |
|---|---|---|---|---|---|
| **Granola** ✅ | UK/US | **Bot-free** (device audio), Mac/Win/iOS | Notepad-style: your rough notes get enhanced by AI. Loved by founders and VCs | ~$14–18/user/mo | $125M Series C at **$1.5B** (Mar 2026, led by Index, with Kleiner Perkins). Launched **Spaces** (team workspaces), AI chat over meetings, **personal + enterprise APIs** (feeding Claude, ChatGPT, Lovable, Replit), SSO/SCIM, consent management. Revenue grew 2.5× Jan→Mar 2026. Audio is transcribed live and not stored. Agentic features on the roadmap. Secondary-market implied valuation ~$2.4B (Sep 2026, unofficial) |
| **Otter.ai** ✅ | US | Bot + mobile/in-person | Live transcripts and captions, OtterPilot, meeting agents | ~$8–10/user/mo Pro; free tier | Raised **$320M from General Catalyst's Customer Value Fund (Oct 20, 2026)** for enterprise growth and international expansion. Facing the **Brewer v. Otter.ai** class action (N.D. Cal., 5:25-cv-06911, filed Aug 2025): it claims recording without consent and training on that data. 🟡 Reported ~$100M ARR in 2025 |
| **Fireflies.ai** ✅ | US | Bot (+ desktop/mobile) | Integrations (claims 6,000+ incl. Zapier), CRM sync, "Talk to Fireflies" Q&A, cross-meeting search | ~$10/user/mo Pro (annual); free tier | Default choice for teams that rely on a CRM. 🟡 Reached ~$1B valuation in 2025 |
| **Fathom** ✅ | US | Bot | Most generous free tier; summaries often ready right as the call ends | Free; Team ~$16–19 | **Acquired by Superhuman (ex-Grammarly) Sep 14, 2026.** 400K+ MAU, 1M+ lifetime users. Will power Superhuman Go agents across email, docs, and calendar |
| **Read.ai** 🟡 | US | Bot + extensions | Meeting, email, and chat "copilot", engagement and sentiment scores, cross-platform search | ~$15/user/mo | Moving toward "AI for all your work comms" |
| **tl;dv** ✅ | Germany | Bot | Clips and highlights, multi-meeting reports, EU-friendly | Free tier; ~$18/user/mo | Strong in EU and SMB sales teams |
| **Fellow** ✅ | Canada | Bot + bot-free | Full meeting workflow: agendas, 1:1s, notes, action items | Free; low-cost Team plan | Ranked #1 in some 2026 roundups; best fit for meeting hygiene, not just notes |
| **MeetGeek** ✅ | Romania | Bot + bot-free desktop/browser/mobile | "Meeting Skills" that update systems, create tasks, draft follow-ups | Freemium | Moving toward agentic actions |
| **Supernormal** ✅ | US | Bot-free option | Notes plus AI-generated slides, docs, spreadsheets; **MCP support** | Freemium | |
| **Sembly** ✅ | US | Bot | Meeting minutes and action items in 40+ languages; "Semblian" agent | Freemium | |
| **Notta** ✅ | Japan | Bot + upload | Cheap, multilingual (strong in Japanese/Asian languages) | ~$8.17/user/mo (annual) | |
| **Jamie** ✅ | Germany | **Bot-free** desktop | Privacy-first, GDPR, works offline in person | Freemium | |
| **Krisp** ✅ | US/Armenia | **Bot-free** (sits in the audio pipeline) | Noise cancellation + transcripts + notes | Free unlimited transcripts; Pro ~$8/mo | Distribution advantage: already installed for noise cancellation |
| **Tactiq** ✅ | Australia | **Bot-free** Chrome extension | Live transcripts for Meet, Zoom, and Teams in the browser | ~$8/user/mo | |
| **Bluedot** ✅ | — | **Bot-free** extension/desktop | Lightweight recorder + notes | Freemium | |
| **Avoma** ✅ | US | Bot | Notes + scheduling + conversation intelligence (CI) | $19–50/user/mo | Positioned as "80% of Gong for a fraction of the price" |
| **Meetily** ✅ | — | Local, open source | Fully local and private processing | Free / OSS | Self-hostable reference implementation |
| 🟡 **Hyprnote** | — | Local, open source | Local-first Granola alternative | OSS | |

### 2B. Platform-native assistants (bundled with the meeting platform)

| Platform | Assistant | 2026 status |
|---|---|---|
| **Zoom** ✅ | AI Companion (3.0) | Ships free with paid Zoom. **"My Notes" works in Teams, Google Meet, and in person (Feb 2026)**. It can join third-party meetings as a guest bot. Voice Recorder covers in-person meetings, plus mobile and a single surface for insights and search. 🟡 One report says the "AI Companion" brand was folded into Zoom Workplace in Jun 2026 |
| **Google Meet** ✅ | Gemini "Take notes for me" | 110M+ monthly users (Apr 2026). **Expanding to in-person meetings and to Zoom and Teams meetings.** Notes go to Google Docs |
| **Microsoft Teams** ✅ | Copilot + **Facilitator agent** | Facilitator takes live notes in meetings and chats (needs an M365 Copilot license). **In-person notes in Teams Rooms on Windows went GA Jun–Jul 2026**; the Android Rooms version slipped to ~Nov 2026. Customizable recaps include screen-share moments |
| Webex 🟡 | Webex AI Assistant | Summaries, catch-up, action items |
| Slack 🟡 | Huddle AI notes | Notes posted to a canvas |
| Notion 🟡 | Notion AI Meeting Notes | Bot-free capture inside Notion pages (launched 2025) |
| ChatGPT 🟡 | Record mode (macOS, business tiers) | Records meetings and voice notes and turns them into canvases and docs |
| Apple 🟡 | Notes/Phone call recording + Apple Intelligence summaries | OS-level; sets the consumer baseline |

**Threat:** the major platforms now give a "good enough" notetaker away **for free and across platforms**, including in person. Standalone tools have to win on cross-platform memory, workflow and agents, privacy, and vertical depth.

### 2C. Conversation / revenue intelligence (sales-focused, enterprise)

| Tool | Notes |
|---|---|
| **Gong** ✅ | Category leader. **"Mission Andromeda" (Feb 2026): Agent Studio, AI Trainer, open MCP support.** ~$1,200–1,600/user/yr + platform fee, quote-only |
| **Clari** ✅ | Enterprise forecasting and pipeline governance; **Wingman** handles call recording. 🟡 Merged with Salesloft (announced late 2025) |
| **Chorus** ✅ | Now part of **ZoomInfo**. Strong for ZoomInfo customers, more friction for everyone else |
| **Avoma** ✅ | Budget CI |
| Jiminny, Modjo (France), Leexi (Belgium), Attention, Sybill, Momentum, Aviso, Revenue.io, Salesforce Einstein Conversation Insights, HubSpot CI 🟡 | Mid-market and challenger players; Attention, Sybill, and Momentum push "auto-fill CRM + agentic follow-up" |

### 2D. Vertical meeting intelligence (deep moats)
- **Recruiting:** Metaview, BrightHire, Pillar 🟡. Interview notes, scorecards, ATS sync.
- **Healthcare (ambient scribes):** Abridge, Microsoft Dragon Copilot (Nuance DAX), Ambience, Suki, Nabla 🟡. The largest-revenue vertical; needs EHR integration and HIPAA compliance.
- **Customer success and support:** Gong, Avoma, Vitally integrations 🟡.
- **Legal, finance, and consulting:** compliance-grade recording (Theta Lake, Smarsh for archiving) 🟡.
- **Education:** lecture capture (Otter, Notta, Turbolearn-style tools) 🟡.

### 2E. Hardware / wearables
| Device | Status |
|---|---|
| **Plaud NotePin / Note** ✅ | Best-known AI recorder; free plan includes 300 min/mo of advanced transcription; weak at linking conversations to each other |
| **Limitless Pendant** ✅ | **Acquired by Meta (Dec 2025)**. No longer sold; team moved into Reality Labs; tech heading toward Ray-Ban Meta glasses |
| **Bee** 🟡 | Always-on wearable (🟡 acquired by Amazon in 2025) |
| **Omi** ✅ | Open-source always-on wearable |
| Viaim, Taya ✅ | Newer earbuds and pendants |

### 2F. Regional leaders 🟡
- **China:** Feishu/Lark Minutes (ByteDance), Tencent Meeting AI assistant, DingTalk (Alibaba), iFlytek recorders. They dominate the domestic market and lead in Mandarin ASR.
- **Japan:** Notta, Rimo Voice, plus Zoom and Teams.
- **Europe:** tl;dv, Jamie, Leexi, Modjo, Noota (recruiting/CRM), Claap. These sell on GDPR and EU data residency.
- **India:** largely Zoom, Teams, and Meet built-ins plus Fireflies and Otter. Hinglish/Indic-language ASR (Sarvam AI, AI4Bharat) is the gap. **This is an opportunity.**

---

## 3. Infrastructure and building blocks (for building meeter)

### 3A. Meeting capture APIs
| Option | What | Notes |
|---|---|---|
| **Recall.ai** ✅ | Meeting bot API (Zoom, Meet, Teams, Webex, Slack) + **Desktop Recording SDK** (bot-free, Jun 2025) + Mobile SDK (announced) | Market leader, ~$31M ARR (Jan 2026, est.), +211% YoY. Most notetakers run on it. 🟡 ~$0.50–0.70/recording-hour |
| **Speak AI** ✅ | Bot API + mobile apps + MCP tools | Positions itself as the Recall alternative (vendor claims) |
| MeetingBaaS, Nylas Notetaker, Skribby, **Attendee** (open source, self-host) 🟡 | Alternative bot APIs | |
| Native platform APIs 🟡 | Zoom RTMS (real-time media streams), Zoom Meeting SDK, Google Meet Media API, Teams Graph transcripts and bots | Free but fragmented; each needs its own app review |
| Bot-free DIY 🟡 | macOS ScreenCaptureKit / Core Audio taps (system audio) + mic; Windows WASAPI loopback; Electron/Tauri app | The approach Granola, Jamie, and Krisp use. No bot in the call, better UX, but consent handling is on you |

### 3B. Speech-to-text (ASR)
| Engine | Strengths | 🟡 Price / WER (vendor-reported, not comparable) |
|---|---|---|
| **Deepgram Nova-3** | Fast streaming, cheap, good diarization | ~$0.0043–0.0125/min; ~5% WER |
| **AssemblyAI Universal** | Accuracy, diarization, entity detection, "LeMUR" LLM layer | ~5–6% WER |
| **ElevenLabs Scribe v2** | Very high accuracy, 90+ languages | 1.7–3.9% (vendor claim) |
| **OpenAI gpt-4o-transcribe / Whisper** | Whisper is free to self-host; 4o is accurate | Whisper ~6–9% WER |
| **Speechmatics** | Accents, diarization, on-prem and on-device | |
| Gladia, Soniox, Google Chirp, AWS Transcribe, Azure Speech, Rev.ai | | |
| **Open source:** Whisper / faster-whisper / WhisperX, **pyannote** (diarization), NVIDIA Parakeet/Canary, Moonshine (edge) | | |

**Rule:** public WER benchmarks barely separate the top engines. **Benchmark on your own multi-speaker, accented, noisy audio** and measure WER plus diarization error rate (DER).

### 3C. Intelligence layer
- LLMs: Claude (Opus 5.5 / Sonnet 5.5 / Haiku 5.5), GPT, Gemini. Long context means a full transcript fits in one call.
- Techniques: structured-output summaries (JSON schema), templates per meeting type, RAG/embeddings across all meetings, speaker-to-identity mapping from calendar invites, MCP servers so external agents can query meeting memory.

---

## 4. Feature checklist (what "best in class" looks like in 2026)

**Table stakes (everyone has these):** transcript, speaker labels, summary, action items, search, Zoom/Meet/Teams support, Slack/Notion/email export, a free tier.

**Differentiators:**
1. **Bot-free capture** that also works in person and on mobile (Granola, Jamie, Krisp, Zoom My Notes, Gemini, Facilitator).
2. **Human + AI notes**: user jots, AI enhances (Granola's signature UX).
3. **Cross-meeting memory and chat**: "what did we promise Acme across the last 5 calls?"
4. **Templates by meeting type**: sales discovery (BANT/MEDDICC), 1:1, standup, interview, user research.
5. **Agentic follow-through**: drafts follow-up emails, updates CRM fields, creates Jira/Linear tickets, schedules the next meeting.
6. **Real-time copilot**: live prompts during the call (objection handling, "you haven't asked about budget"), live Q&A.
7. **APIs + MCP**: meeting context as infrastructure for other AIs (Granola, Gong, Supernormal).
8. **Team spaces and permissions**, plus enterprise controls (SSO, SCIM, retention, deletion, consent management).
9. **Multilingual + code-switching** (e.g., Hinglish).
10. **Analytics**: talk ratio, sentiment, meeting cost, recurring-meeting health.

---

## 5. Legal, privacy and trust (critical)
- **Consent laws:** US one-party vs. two/all-party consent states (CA, FL, IL, WA, PA, etc.); GDPR in the EU (lawful basis, DPA, data residency); India's DPDP Act 2023; Illinois BIPA for voiceprints and speaker ID.
- **Live litigation risk:** *Brewer v. Otter.ai* (N.D. Cal., filed Aug 15, 2025, pending as of last reporting). It alleges wiretap and privacy violations because a bot joins without all-party consent and recordings were used for model training. **Lessons:** announce the recording to every participant, make AI training opt-in, and let anyone request deletion.
- **Bot fatigue:** many companies block third-party bots. Bot-free capture avoids that but moves the consent burden onto the user.
- **Enterprise must-haves:** SOC 2 Type II, ISO 27001, HIPAA (health), zero data retention with LLM vendors, regional hosting, admin controls, audit logs.

---

## 6. Market dynamics (2025–2026)
- **Consolidation:** Superhuman bought Fathom (Sep 2026); Meta bought Limitless (Dec 2025); ZoomInfo owns Chorus; 🟡 Clari merged with Salesloft; 🟡 Amazon bought Bee.
- **Big money keeps coming:** Granola raised at $1.5B (Mar 2026); Otter raised $320M (Oct 2026); Recall.ai is growing 200%+ YoY.
- **Bundling pressure:** Zoom, Google, and Microsoft all went cross-platform and in-person in 2026, so the standalone note-taking wedge keeps shrinking.
- **Shift from notes to context infrastructure to agents:** the winners position meetings as the **context layer** for company AI (APIs, MCP, agent studios).
- **Bot-free is winning on UX** in prosumer and team markets; bots remain the norm for sales CI, where recording every call is policy.

---

## 7. Opportunity gaps for meeter (where a new entrant can win)
1. **Indic / multilingual + code-switching** (Hindi-English, Tamil-English, etc.): the global leaders handle these poorly.
2. **Privacy-first, local or on-device** processing (on-device Whisper/Parakeet + local LLM), aimed at legal, health, and government buyers.
3. **Agent-first**: not "notes" but "the meeting's work gets done" (tickets filed, CRM updated, docs drafted, follow-ups sent), with human approval.
4. **Vertical depth**: a niche the horizontals ignore (recruiting in India, real estate, education/coaching, founders and investors, agencies, field sales).
5. **Mobile-first and in-person**: WhatsApp-native summaries, phone calls, offline meetings.
6. **Cross-tool memory**: unify meetings, chats, and email into a single knowledge graph with an MCP server.
7. **Pricing**: undercut on cost in emerging markets.

### Suggested MVP stack 🟡
- Capture: Recall.ai (fastest to ship) **or** bot-free desktop (Tauri/Electron + system audio) for differentiation.
- ASR: Deepgram (streaming) or AssemblyAI; fall back to self-hosted WhisperX + pyannote to cut cost.
- LLM: Claude Sonnet 5.5 for summaries and structured extraction; Haiku 5.5 for cheap realtime work.
- Storage and search: Postgres + pgvector; S3 for audio with an optional no-store mode.
- Integrations, phase 1: Google Calendar, Slack, Notion, HubSpot; email follow-up.
- Expose an MCP server from day one.

---

## 8. Quick "which tool for whom" cheat sheet
| Need | Pick |
|---|---|
| Solo/founder, no bot, great notes | Granola |
| Best free tier | Fathom (now Superhuman), Krisp, Tactiq |
| Live captions, education, accessibility | Otter |
| Sales team on a CRM, many integrations | Fireflies, Avoma |
| Enterprise sales coaching and forecasting | Gong, Clari |
| Already all-in on one suite | Zoom AI Companion / Gemini in Meet / Teams Copilot + Facilitator |
| EU privacy | Jamie, tl;dv |
| Full meeting hygiene (agendas, 1:1s) | Fellow |
| Fully local / open source | Meetily, Hyprnote, Whisper + pyannote |
| Hardware for in-person | Plaud |
| Building your own product | Recall.ai + Deepgram/AssemblyAI + Claude |

---

## Sources (2026 research)
- TechRepublic — https://www.techrepublic.com/article/news-best-ai-meeting-note-takers-2026/
- OfficePicks comparison — https://officepicks.net/blog/ai-meeting-assistants-2026
- Granola Series C — https://thenextweb.com/news/granola-series-c-meeting-ai-enterprise-context · https://www.reworked.co/digital-workplace/granola-raises-125m-launches-enterprise-context-tools/
- Otter $320M — https://techcrunch.com/2026/10/20/otter-ai-raises-320-million-from-general-catalysts-growth-fund-for-its-meeting-tool
- Otter lawsuit — https://www.npr.org/2026/08/15/g-s1-83087/otter-ai-transcription-class-action-lawsuit · https://www.fisherphillips.com/print/v2/content/42603/new-lawsuit-highlights-concerns-about-ai-notetakers.pdf
- Superhuman acquires Fathom — https://blog.superhuman.com/superhuman-acquires-fathom/ · https://www.reworked.co/collaboration-productivity/superhuman-buys-ai-notetaker-fathom-to-bring-meeting-insights-into-work/
- Fireflies vs Fathom — https://tldv.io/blog/fireflies-vs-fathom/
- Zoom cross-platform — https://www.uctoday.com/unified-communications/zoom-ai-companion-microsoft-teams-google-meet/
- Google Meet notes expansion — https://www.androidauthority.com/p-3659933/
- Teams Facilitator — https://m365admin.handsontek.net/microsoft-teams-facilitator-agent-takes-notes-meetings-chats/ · https://teams.handsontek.net/2026/06/01/whats-new-microsoft-teams-may-2026/
- Conversation intelligence — https://www.aviso.com/blog/best-conversation-intelligence-tools-2026 · https://www.lemlist.com/blog/best-conversational-intelligence-software-2026-buyer-guide · https://blog.abmatic.ai/chorus-alternatives
- Recall.ai — https://www.recall.ai/blog/desktop-recording-sdk · https://sacra.com/research/recall-ai-at-31m-year/
- Wearables / Limitless — https://fast.io/resources/limitless-ai-review-2026/ · https://bibigpt.co/blog/posts/ai-wearable-notetaker-meeting-transcription-workflow
- Speech-to-text — https://speechmatics.com/company/articles-and-news/best-speech-to-text-ai-guide-apis-platforms-and-services-compared · https://deploybase.ai/articles/best-speech-to-text-api
- Others — https://www.itechguides.com/best/meeting-notes-software/ · https://fellow.ai/blog/bluedot-ai-notetaker-alternatives/
