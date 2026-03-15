# Youtube Plus v3 🎵

Spatial Audio video platformu — AI Modu + Stripe ile gerçek para çekme.

## Kurulum (10 dakika)

### 1. Stripe API Anahtarı Al
1. [stripe.com](https://stripe.com) → Hesap oluştur veya giriş yap
2. Dashboard → Developers → API Keys
3. **Secret key**'i kopyala (`sk_test_...` veya `sk_live_...`)

### 2. GitHub'a Yükle
```
youtube-plus/
├── index.html
├── api/
│   └── create-payout.js
├── package.json
├── vercel.json
└── README.md
```

### 3. Vercel'e Deploy Et
1. [vercel.com](https://vercel.com) → GitHub ile giriş yap
2. "New Project" → bu repo'yu seç
3. **Environment Variables** ekle:
   - Key: `STRIPE_SECRET_KEY`
   - Value: `sk_test_XXXXXXXXXXXX` (Stripe'tan kopyaladığın)
4. Deploy! ✅

### 4. Test Et
- Stripe test kartı: `4242 4242 4242 4242`
- Son kullanım: herhangi gelecek tarih (örn: `12/26`)
- CVV: herhangi 3 rakam (örn: `123`)

## Özellikler
- 🎵 Spatial Audio (Dolby Atmos, TrueHD 7.1, PCM 7.1)
- 🤖 AI Dinleme & Şarkı Söyleme Modu
- 💰 Gerçek para kazanma sistemi
- 💳 Stripe ile karta çekim
- 📱 PWA — ana ekrana eklenebilir

## Notlar
- Test modunda `sk_test_` key kullan
- Gerçek ödemelere geçmek için `sk_live_` key ve Stripe onayı gerekli
- Minimum çekim: ₺50
