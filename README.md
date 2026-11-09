# IDEDITOR 📝

A powerful, fully browser-based, serverless code editor. Write HTML, CSS, and JavaScript, preview your code live, manage GitHub repositories, and use AI to write code—all directly from your browser without any backend servers.

![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Serverless](https://img.shields.io/badge/Backend-Serverless-brightgreen.svg)

## 🚀 Features

- **Multi-Project Dashboard:** Create, manage, and switch between multiple projects seamlessly.
- **AI Assistant:** Built-in chat interface supporting **OpenAI**, **Groq**, and **Google Gemini**. It reads your active file for context and features an **"Apply to Editor"** button to instantly write code directly into your files.
- **Monaco Editor:** Powered by the same engine as VS Code, featuring syntax highlighting, auto-complete, and minimap.
- **Live Preview & Console:** Instantly run and preview your projects with a built-in console for debugging.
- **GitHub Integration (REST API):**
  - Clone public and private repositories.
  - Push changes (commit directly to GitHub).
  - Switch branches seamlessly via a dropdown.
  - View Git commit graphs.
- **Firebase Cloud Sync:**
  - Login with Google.
  - Save and load entire projects securely to the cloud.
  - Automatically syncs GitHub Personal Access Tokens across devices.
- **Custom Themes:** Choose between Dark, Light, Dracula, Monokai, and GitHub Dark.
- **Built-in Terminal:** Execute simulated shell commands right in the editor.
- **Import/Export:** Drag-and-drop file importing and ZIP project exporting.

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (100% Client-Side)
- **Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Auth & Database:** [Firebase](https://firebase.google.com/) (Authentication & Firestore)
- **Git Operations:** [GitHub REST API](https://docs.github.com/en/rest)
- **AI Providers:** OpenAI API, Groq API, Google Gemini API
- **Utilities:** Prettier (formatting), JSZip (export), LZString (URL sharing)

## 💻 Getting Started

Since IDEDITOR is 100% client-side, you don't need a complex backend setup. 

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME