# IDEDITOR 📝

A powerful, fully browser-based, serverless code editor. Write HTML, CSS, and
JavaScript, preview your code live, manage GitHub repositories, and run a
multi-agent AI assistant — all directly from your browser without any backend.

![Version](https://img.shields.io/badge/Version-2.1.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Serverless](https://img.shields.io/badge/Backend-Serverless-brightgreen.svg)
![PWA](https://img.shields.io/badge/PWA-Installable-purple.svg)

---

## 🚀 Features

### 🤖 Multi-Agent AI Assistant
- **10 providers, all first-class:** OpenAI, Groq, Google Gemini, Together,
  OpenRouter, Fireworks, Mistral, Ollama (local), Custom, and Mock (for
  testing without any key)
- **Multiple named agents** — each with its own provider, model, system
  prompt, temperature, and pipeline role
- **3 orchestration modes:**
  - **Single** — one agent answers
  - **Parallel** — up to 4 agents answer the same prompt simultaneously
  - **Pipeline** — agents run in sequence, each receiving the previous
    step's output as context
- **Apply / Keep / Discard** for AI code blocks (Copilot-style) — apply
  writes the code (undoable), Keep confirms, Discard reverts with a
  confirmation dialog if you've edited since
- **Context-aware** — the active file is automatically injected into every
  prompt
- **Test connection** button per agent — verifies the config with a 1-token
  request before saving

### 📂 Multi-Project Workspace
- Create, clone-from-GitHub, switch, and delete projects
- Per-project file sets, persisted locally
- Projects dashboard with cards, dates, file counts

### ✍️ Monaco Editor
- Same engine as VS Code — syntax highlighting, auto-complete, minimap
- Files & folders tree with rename, delete, filter
- Find & Replace with case sensitivity and multi-line search
- Auto-format via Prettier
- Font-size controls, theme selector, minimap toggle

### 👁️ Live Preview & Console
- Instant run with optional debounced auto-run
- **Desktop / Mobile layout toggle** — mobile mode constrains the iframe to
  a phone-shaped device frame (375px)
- Built-in console capturing `console.*` and uncaught errors, with
  click-to-jump-to-line
- Fullscreen preview, download-preview HTML, close
- Embedded preview runs in a sandboxed iframe without same-origin access

### 🐙 GitHub Integration (REST API)
- Clone public and private repos via Personal Access Token
- Commit and push changes to any branch
- Branch selector with live reload on switch
- Commit graph viewer

### ☁️ Firebase Cloud Sync
- Login with Google
- Save and load projects to Firestore
- Repository URL preferences can sync; GitHub tokens remain in tab memory only and must be re-entered after refresh

### 🎨 Themes
Dark (default), Light, Dracula, Monokai, GitHub Dark — Monokai and
Dracula are custom-registered Monaco themes, so syntax highlighting
matches the chrome

### 💻 Built-in Terminal
Simulated shell with commands: `help`, `ls`, `cat`, `touch`, `mkdir`,
`run`, `format`, `theme`, `git`, `firebase`

### 📦 Import / Export
- **Import** — drag or select files (`.html .css .js .ts .json .md .svg`)
- **Export** — download the project as a ZIP
- **Share** — generate a compressed URL of the entire project (LZ-String)

### 📱 PWA
- Installable on desktop and mobile
- Responsive mobile layout with a touch-friendly action bar
- Offline shell caching via service worker

---

## 🔐 Security & Credential Handling

- Project previews run in a sandboxed iframe with scripts enabled but same-origin access, popups, and top-level navigation disabled.
- Preview console messages are accepted only from the actual preview frame and are type-checked and length-limited.
- AI Markdown is sanitized against an HTML allowlist before it is inserted into the chat.
- GitHub Personal Access Tokens and AI provider API keys are memory-only. They are not persisted to local storage or Firebase.
- Older locally stored credential values are removed during app startup. Sign in to Firebase once after updating so IDEDITOR can remove a legacy Git token field from your cloud settings.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML, CSS, JavaScript (100% client-side) |
| **Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **Auth & Database** | [Firebase](https://firebase.google.com/) — Auth + Firestore |
| **Git Operations** | [GitHub REST API](https://docs.github.com/en/rest) |
| **AI Providers** | OpenAI · Groq · Google Gemini · Together · OpenRouter · Fireworks · Mistral · Ollama · Custom |
| **Utilities** | Prettier (formatting), JSZip (export), LZ-String (share URLs) |

---

## 💻 Getting Started

IDEDITOR is 100% client-side — no backend, no build step, no `npm install`.

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME