# IDEDITOR

A browser-based code editor with Monaco editing, live preview, a terminal, Firebase project storage, and browser-based Git operations.

## Features

- Edit HTML, CSS, JavaScript, TypeScript, JSON, Markdown, and text files.
- Filter files in the Explorer sidebar by name or path. Press `Esc` to clear the filter.
- Run the current project in the live preview pane.
- Use the built-in Console and Terminal panels.
- Import local files and export projects as ZIP files.
- Save and load projects with Firebase after signing in.
- Clone, commit, pull, push, and view Git history.

## Git setup

1. Open **Git Settings** in the Source Control section.
2. Enter the repository URL, for example `https://github.com/user/repository.git`.
3. Enter a GitHub personal access token for private repositories.
4. Save the settings and confirm the clone.

The terminal also supports:

```text
git clone <repository-url>
git status
git commit -m "message"
git pull
git push
```

Git requests use the `/api/proxy` serverless endpoint so browser CORS restrictions do not block repository access.
