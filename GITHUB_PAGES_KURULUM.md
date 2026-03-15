# Youtube Plus — GitHub Pages Yayınlama Rehberi

## Sitenin Adresi (Yayına Girdikten Sonra)

```
https://telifli71amaiyiniyetle.github.io/youtubeplus/
```

---

## Adım 1 — Dosyaları Repoya Yükle

Bu paketteki `public/` klasörünün içindeki dosyaları GitHub reponuza yükleyin:

| Dosya | Açıklama |
|---|---|
| `public/index.html` | Ana site dosyası (SEO + API ayarları eklendi) |
| `public/404.html` | Sayfa bulunamadı yönlendirmesi |
| `public/.nojekyll` | GitHub Pages Jekyll işlemini devre dışı bırakır |

**Mevcut `public/index.html` dosyasını bu yeni versiyonla değiştirin.**

---

## Adım 2 — GitHub Pages'i Etkinleştir

1. GitHub'da `youtubeplus` reposuna gidin
2. **Settings** → **Pages** sekmesine tıklayın
3. **Source** olarak `Deploy from a branch` seçin
4. **Branch**: `main` | **Folder**: `/ (root)` seçin
5. **Save** butonuna tıklayın

> **Önemli:** GitHub Pages `public/` klasörünü otomatik olarak servis etmez.
> Aşağıdaki iki seçenekten birini kullanın:

### Seçenek A — `docs/` klasörü yöntemi (Önerilen)

`public/` klasörünün içeriğini `docs/` klasörüne taşıyın:

```
youtubeplus/
└── docs/
    ├── index.html
    ├── 404.html
    └── .nojekyll
```

Sonra GitHub Pages ayarında **Folder**: `/docs` seçin.

### Seçenek B — Root yöntemi

`public/` içindeki dosyaları doğrudan repo köküne taşıyın:

```
youtubeplus/
├── index.html      ← public/index.html buraya taşındı
├── 404.html
├── .nojekyll
├── server.js
└── package.json
```

Sonra GitHub Pages ayarında **Folder**: `/ (root)` seçin.

---

## Adım 3 — Backend URL'sini Ayarla

Site yayına girdikten sonra, backend sunucunuzu başlatıp URL'yi `index.html` içinde güncelleyin:

```html
<!-- index.html içinde bu satırı bulun ve güncelleyin -->
<script>
  window.API_BASE = 'https://SENIN-NGROK-URL.ngrok-free.app';
  // Örnek: 'https://abc123.ngrok-free.app'
  // Cloudflare Tunnel: 'https://xyz.trycloudflare.com'
</script>
```

### Backend'i Başlatma

```bash
# Terminal 1 — Sunucuyu başlat
cd youtubeplus
node server.js

# Terminal 2 — İnternete aç (ngrok ile)
ngrok http 3000
```

Ngrok size şöyle bir URL verecek:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

Bu URL'yi `window.API_BASE` değerine yazın ve `index.html` dosyasını güncelleyip GitHub'a push edin.

---

## Google'da Görünürlük (SEO)

Site yayına girdikten sonra Google'a eklemek için:

1. [Google Search Console](https://search.google.com/search-console) adresine gidin
2. **URL prefix** seçeneğiyle sitenizi ekleyin:
   ```
   https://telifli71amaiyiniyetle.github.io/youtubeplus/
   ```
3. **URL Inspection** aracıyla ana sayfanızı Google'a bildirin
4. **Request Indexing** butonuna tıklayın

> Google'ın sitenizi indekslemesi genellikle **1-7 gün** sürer.

---

## Tarayıcı Desteği (Atmos için)

| Tarayıcı | Atmos Desteği |
|---|---|
| Microsoft Edge | ✅ Gerçek Dolby Atmos |
| Safari (Mac/iOS) | ✅ Atmos destekler |
| Chrome | ⚠ Stereo downmix |
| Firefox | ⚠ Stereo downmix |
