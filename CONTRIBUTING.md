# Katkı Rehberi

AI SSH Terminal projesine katkıda bulunmak istediğiniz için teşekkürler!

## Başlamadan Önce

1. Mevcut [issue](https://github.com/your-repo/ai-ssh-terminal/issues) listesini kontrol edin.
2. Büyük bir değişiklik planlıyorsanız önce bir issue açarak tartışın.

## Geliştirme Ortamı

### Gereksinimler

- Node.js 20+
- npm 10+
- Windows, macOS veya Linux

### Kurulum

```bash
git clone https://github.com/your-repo/ai-ssh-terminal.git
cd ai-ssh-terminal
npm install
npm run dev
```

## Dal Stratejisi

| Amaç | Dal Adı |
|------|---------|
| Yeni özellik | `feat/ozellik-adi` |
| Hata düzeltme | `fix/hata-adi` |
| Dokümantasyon | `docs/konu` |

`main` dalına doğrudan commit atmayın. Her zaman bir dal açıp Pull Request gönderin.

## Kod Standartları

- TypeScript zorunlu — `any` tip kullanmaktan kaçının.
- Electron IPC güvenliği: `contextIsolation: true`, `nodeIntegration: false`.
- Renderer process'ten asla credential veya SSH işlemi yapmayın; main process üzerinden IPC ile yapın.
- AI modeline parola/credential göndermeyin.

## Testler

```bash
npm test
```

Yeni bir özellik eklerken ilgili testleri de `tests/` dizinine ekleyin.

## Pull Request Süreci

1. `main`'den güncel dalı çekin.
2. Değişikliklerinizi küçük, odaklı commit'lere bölün.
3. PR açıklamasında ne yaptığınızı ve neden yaptığınızı açıklayın.
4. Testlerin geçtiğinden emin olun.

## Güvenlik Açığı Bildirimi

Güvenlik açıklarını kamuya açık issue olarak bildirmeyin. Doğrudan proje sahiplerine özel mesaj gönderin.

## Lisans

Bu projeye katkıda bulunarak, katkılarınızın [MIT Lisansı](LICENSE) altında yayınlanacağını kabul etmiş olursunuz.
