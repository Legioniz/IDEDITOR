# IDEDITOR 📝

A powerful, fully browser-based code editor designed for both mobile and desktop. Write HTML, CSS, and JavaScript, preview your code live, and manage your GitHub repositories directly from your browser without any backend servers.

![IDEDITOR Preview](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 🚀 Features

- **Multi-Project Dashboard:** Create, clone, and manage multiple coding projects.
- **Monaco Editor:** Powered by the same engine as VS Code, featuring syntax highlighting, auto-complete, and minimap.
- **Live Preview:** Instantly run and preview your HTML/CSS/JS projects with a built-in console.
- **GitHub Integration (REST API):**
  - Clone public and private repositories.
  - Push changes (commit directly to GitHub).
  - Switch branches seamlessly.
  - View Git commit graphs.
- **Firebase Cloud Sync:**
  - Login with Google.
  - Save and load projects securely to the cloud.
  - Automatically syncs GitHub Personal Access Tokens across devices.
- **Built-in Terminal:** Execute simulated shell commands right in the editor.
- **Custom Themes:** Choose between Dark, Light, Dracula, Monokai, and GitHub Dark.
- **Import/Export:** Drag-and-drop file importing and ZIP project exporting.

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Auth & Database:** [Firebase](https://firebase.google.com/) (Authentication & Firestore)
- **Git Operations:** [GitHub REST API](https://docs.github.com/en/rest)
- **Utilities:** Prettier (formatting), JSZip (export), LZString (URL sharing)

## 💻 Getting Started

Since IDEDITOR is 100% client-side, you don't need a complex backend setup. 

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME