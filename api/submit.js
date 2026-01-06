export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, subscriptions, monthly_total, yearly_total } = req.body;
    if (!email || !subscriptions) return res.status(400).json({ error: 'Email and subscriptions required' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    await fetch(`${supabaseUrl}/rest/v1/audit_signups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, subscriptions, monthly_total, yearly_total })
    });

    const subscriptionRows = subscriptions
      .sort((a, b) => b.price - a.price)
      .map(s => `<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;">${s.name}</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;text-align:right;font-family:monospace;">$${s.price.toFixed(2)}/mo</td></tr>`)
      .join('');

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,sans-serif;background:#f5f5f4;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background:#1c1917;padding:32px;text-align:center;"><h1 style="color:#f59e0b;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px 0;">DIVERGENT MONEY</h1><h2 style="color:white;font-size:28px;margin:0;">Your Subscription Audit</h2></div><div style="padding:32px;text-align:center;border-bottom:1px solid #e5e5e5;"><p style="color:#666;margin:0 0 16px 0;">You're spending</p><p style="font-size:48px;font-weight:700;color:#1c1917;margin:0;font-family:monospace;">$${monthly_total.toFixed(2)}<span style="font-size:20px;color:#666;">/mo</span></p><p style="font-size:24px;color:#d97706;font-weight:600;margin:16px 0 0 0;">$${Math.round(yearly_total).toLocaleString()}/year</p></div><div style="padding:24px 32px;"><table style="width:100%;border-collapse:collapse;">${subscriptionRows}</table></div><div style="padding:24px 32px;background:#fef3c7;"><p style="margin:0;color:#92400e;"><strong>We'll remind you before these renew.</strong></p></div></div></body></html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Divergent Money <onboarding@resend.dev>',
        to: email,
        subject: `Your subscriptions: $${monthly_total.toFixed(2)}/mo`,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.json();
      return res.status(500).json({ error: 'Failed to send email', details: err });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
