<p align="center">
  <img src="../app-icon.png" alt="SlimGit" width="120">
</p>

<p align="center">
  <a href="../README.md">Tiếng Việt</a> |
  <b>English</b>
</p>

<h1 align="center">SlimGit</h1>

<p align="center">
  A slim, SmartGit-style desktop Git client — but simpler.<br>
  Built with Tauri + React
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-12.0+-blue?style=flat-square" alt="macOS 12+">
  <img src="https://img.shields.io/badge/Windows-10+-blue?style=flat-square" alt="Windows 10+">
  <img src="https://img.shields.io/badge/built%20with-Tauri%20+%20React-orange?style=flat-square" alt="Tauri + React">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#development">Development</a> ·
  <a href="#tech-stack">Tech Stack</a>
</p>

---

<p align="center">
  <img src="assets/screenshot.png" alt="SlimGit screenshot" width="820">
</p>

---

## Installation

Download the latest release for your platform from the [Releases](../../releases) page.

| Platform | Format      |
|----------|-------------|
| macOS    | `.dmg`      |
| Windows  | `.msi`      |
| Linux    | `.AppImage` |

---

## Development

**Prerequisites:** [Rust](https://rustup.rs/) · [Node.js](https://nodejs.org/) 18+ · [Git](https://git-scm.com/)

```bash
npm install
npm run tauri dev     # desktop app with hot-reload
```

**UI preview in browser (no Rust build needed):**

```bash
npm run dev           # http://localhost:1420
```

`src/mock.ts` serves realistic sample data when running outside Tauri — handy for iterating on the UI without a native build.

**Production build:**

```bash
npm run tauri build   # bundle in src-tauri/target/release/bundle
```

---

## Tech Stack

- **Frontend:** React · TypeScript · Vite
- **Backend:** Rust (Tauri)
- **Git:** native `git` CLI

---

## License

MIT — see [LICENSE](../LICENSE).