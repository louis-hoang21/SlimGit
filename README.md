<p align="center">
  <img src="app-icon.png" alt="SlimGit" width="120">
</p>

<p align="center">
  <b>Tiếng Việt</b> |
  <a href="docs/README.en.md">English</a>
</p>

<h1 align="center">SlimGit</h1>

<p align="center">
  Ứng dụng Git client cho desktop theo phong cách SmartGit — nhưng đơn giản hơn.<br>
  Xây dựng bằng Tauri + React
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-12.0+-blue?style=flat-square" alt="macOS 12+">
  <img src="https://img.shields.io/badge/Windows-10+-blue?style=flat-square" alt="Windows 10+">
  <img src="https://img.shields.io/badge/xây%20dựng%20bằng-Tauri%20+%20React-orange?style=flat-square" alt="Tauri + React">
  <img src="https://img.shields.io/badge/giấy%20phép-MIT-green?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <a href="#cài-đặt">Cài đặt</a> ·
  <a href="#phát-triển">Phát triển</a> ·
  <a href="#công-nghệ">Công nghệ</a>
</p>

---

<p align="center">
  <img src="docs/assets/screenshot.png" alt="SlimGit screenshot" width="820">
</p>

---

## Cài đặt

Tải bản mới nhất tại trang [Releases](../../releases).

| Nền tảng | Định dạng   |
|----------|-------------|
| macOS    | `.dmg`      |
| Windows  | `.msi`      |
| Linux    | `.AppImage` |

---

## Phát triển

**Yêu cầu:** [Rust](https://rustup.rs/) · [Node.js](https://nodejs.org/) 18+ · [Git](https://git-scm.com/)

```bash
npm install
npm run tauri dev     # chạy app desktop với hot-reload
```

**Xem UI trên trình duyệt (không cần build Rust):**

```bash
npm run dev           # http://localhost:1420
```

`src/mock.ts` cung cấp dữ liệu mẫu khi chạy ngoài Tauri — tiện để chỉnh UI mà không cần build native.

**Build bản production:**

```bash
npm run tauri build   # bundle tại src-tauri/target/release/bundle
```

---

## Công nghệ

- **Frontend:** React · TypeScript · Vite
- **Backend:** Rust (Tauri)
- **Git:** native `git` CLI

---

## Giấy phép

MIT — xem [LICENSE](LICENSE).
