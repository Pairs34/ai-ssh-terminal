# AI SSH Terminal

> AI destekli SSH terminal ve ağ yönetim uygulaması — Electron + React + TypeScript

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)

---

## Özellikler

### 🖥️ SSH Terminal
- xterm.js tabanlı tam PTY terminali
- Çoklu SSH bağlantısı ve sekme yönetimi (Workspace)
- Kimlik bilgileri `electron.safeStorage` ile şifreli olarak saklanır
- Grup ve çevrimiçi/çevrimdışı durum takibi

### 🤖 AI Asistan
- OpenAI uyumlu herhangi bir API ile çalışır (endpoint + model ayarlanabilir)
- **Tek sohbet akışı:** Salt okunur komutları otomatik çalıştırır; yapılandırma değiştiren komutları kullanıcı onayına sunar
- Risk sınıflandırması: `safe` → `low` → `medium` → `high` → `critical`
- Felaket komutları (`rm -rf /`, `format`, `factory-reset` vb.) onayla dahi çalıştırılamaz
- Yüksek etkili işlemlerde ikinci, zorunlu onay adımı

### 📚 Komut Hafızası (Verified Command KB)
- Öğrenilen CLI komutlarını vendor/platform/OS bazında saklar
- Şablon tabanlı komutlar: `show lldp neighbor {{interface}}`
- Doğrulama yaşam döngüsü: `draft → learned → tested → verified → trusted → deprecated`
- Hibrit retrieval: metadata filtresi + metin/embedding benzerliği + skor
- Platform/sürüm uyumsuz ve deprecated komutlar otomatik elenir

### 📄 Doküman Hafızası (Document KB)
- PDF, TXT, Markdown, HTML ve DOCX yükleme desteği
- SHA-256 deduplication, şifreli PDF ve ZIP bombası koruması
- Sayfa ve CLI komutu koruyan mantıksal chunking
- Arka planda asenkron işleme (UI'yi bloklamaz)

### 🌐 Ağ Tarama
- CIDR aralığı ping/port taraması
- ARP/MAC okuma ve OUI vendor tahmini
- Tarama sonuçlarından toplu cihaz ekleme

---

## Gereksinimler

- **Node.js** 20 veya üzeri
- **npm** 10 veya üzeri
- Windows 10+, macOS 12+ veya Linux (Ubuntu 22.04+)

---

## Kurulum

```bash
git clone https://github.com/your-repo/ai-ssh-terminal.git
cd ai-ssh-terminal
npm install
```

> `postinstall` adımı `better-sqlite3`'ü otomatik olarak Electron için yeniden derler.

### Geliştirme

```bash
npm run dev
```

Vite dev server (renderer) ve Electron main process derlemesini paralel başlatır.

---

## Yapılandırma

Uygulama içindeki **Ayarlar** ekranından yapılandırılır, herhangi bir ortam değişkeni veya yapılandırma dosyası **gerekmez**.

| Alan | Açıklama |
|------|----------|
| API Base URL | OpenAI uyumlu endpoint (örn. `https://api.openai.com/v1`) |
| API Key | Sağlayıcınızın API anahtarı |
| Model | Kullanılacak model adı (örn. `gpt-4o`) |

> **Güvenlik notu:** API anahtarı `electron.safeStorage` ile şifrelenir, düz metin olarak saklanmaz.

---

## Derleme (Production)

Uygulama ikonları için `resources/icons/` altına aşağıdaki dosyaları ekleyin:
- `icon.ico` (Windows)
- `icon.icns` (macOS)
- `icon.png` (Linux — 512×512 önerilir)

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Çıktı `release/` dizinine yazılır.

---

## Mimari

```
ai-ssh-terminal/
├── electron/
│   ├── main/          # Electron main process (Node.js)
│   │   ├── ai/        # AI provider, güvenlik, komut ve doküman KB
│   │   ├── credentials/  # Kimlik bilgisi şifreleme (safeStorage)
│   │   ├── database/  # Drizzle ORM + SQLite şema ve migrasyon
│   │   ├── ipc/       # IPC handler'ları
│   │   ├── scanner/   # Ağ tarama motoru
│   │   └── ssh/       # SSH bağlantı yönetimi (ssh2)
│   └── preload/       # Context bridge (contextIsolation: true)
├── src/               # React renderer (Vite + TypeScript)
│   ├── features/      # AI, terminal, cihazlar, geçmiş, RAG ekranları
│   └── components/    # Paylaşılan bileşenler
├── database/          # Migrasyon dosyaları
└── tests/             # Birim testleri
```

**Teknoloji Stack:**
`Electron 33` · `React 18` · `TypeScript` · `Vite` · `Tailwind CSS` · `Drizzle ORM` · `SQLite (better-sqlite3)` · `xterm.js` · `ssh2` · `Zustand` · `Framer Motion`

---

## Güvenlik

- SSH kimlik bilgileri `electron.safeStorage` ile şifrelenir; API yüzeyinden hiçbir zaman düz metin dönmez.
- Kimlik çözme yalnızca main process içinde gerçekleşir; renderer'a ulaşmaz.
- AI modeline parola veya kimlik bilgisi gönderilmez.
- Tehlikeli komut kalıpları `ai/safety.ts` katmanında çalıştırılmadan engellenir.
- `contextIsolation: true` · `nodeIntegration: false` · `sandbox: true`

---

## Testler

```bash
npm test
```

---

## Katkı

Katkı yapmak ister misiniz? [CONTRIBUTING.md](CONTRIBUTING.md) dosyasını inceleyin.

---

## Lisans

[MIT](LICENSE)
