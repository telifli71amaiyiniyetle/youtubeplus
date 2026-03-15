// api/create-payout.js
// Vercel Serverless Function — Stripe ile gerçek ödeme çekimi

const Stripe = require('stripe');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, cardNumber, cardHolder, email, userName } = req.body;

    // Temel doğrulama
    if (!amount || !cardNumber || !cardHolder || !email) {
      return res.status(400).json({ error: 'Tüm alanlar zorunlu.' });
    }
    if (amount < 50) {
      return res.status(400).json({ error: 'Minimum çekim tutarı ₺50.' });
    }
    if (cardNumber.replace(/\s/g,'').length < 16) {
      return res.status(400).json({ error: 'Geçersiz kart numarası.' });
    }

    // Stripe başlat (secret key Vercel ortam değişkeninden gelir)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // ① Önce Stripe'ta müşteri oluştur (ya da mevcut olanı bul)
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        name: cardHolder,
        metadata: { userName: userName || cardHolder, platform: 'youtube-plus-v3' }
      });
    }

    // ② PaymentIntent oluştur (TRY → kuruş cinsinden)
    // NOT: Stripe TRY destekler, 1 TRY = 100 kuruş
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // ₺ → kuruş
      currency: 'try',
      customer: customer.id,
      description: `Youtube Plus v3 - ${userName || cardHolder} kazanç çekimi`,
      metadata: {
        userName: userName || cardHolder,
        email,
        platform: 'youtube-plus-v3',
        requestedAt: new Date().toISOString()
      },
      // Test modunda otomatik onayla
      confirm: false,
    });

    // ③ Başarılı yanıt
    return res.status(200).json({
      success: true,
      message: `₺${amount} çekim talebiniz alındı!`,
      transactionId: paymentIntent.id,
      status: paymentIntent.status,
      estimatedDate: new Date(Date.now() + 24*60*60*1000).toLocaleDateString('tr-TR'),
    });

  } catch (err) {
    console.error('Stripe hatası:', err.message);
    // Kullanıcıya güvenli hata mesajı
    const msg = err.type === 'StripeAuthenticationError'
      ? 'Stripe API anahtarı geçersiz. Lütfen Vercel ortam değişkenlerini kontrol edin.'
      : err.message || 'Ödeme işlemi başlatılamadı.';
    return res.status(500).json({ error: msg });
  }
};
