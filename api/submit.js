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
    
    // Generate unsubscribe token
    const unsubscribe_token = crypto.randomUUID();
    const prices_last_verified = new Date().toISOString();

    // Save to Supabase
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/audit_signups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ 
        email, 
        subscriptions, 
        monthly_total, 
        yearly_total,
        unsubscribe_token,
        prices_last_verified
      })
    });

    if (!dbResponse.ok) {
      const err = await dbResponse.text();
      console.error('Supabase error:', err);
    }

    // Color palette for email segments
    const emailColors=['#d97706','#0891b2','#7c3aed','#dc2626','#16a34a','#db2777','#2563eb','#ca8a04','#64748b','#f97316'];
    
    // Calculate monthly prices for each subscription
    const subsWithMonthly = subscriptions.map(s => ({
      ...s,
      monthlyPrice: s.billing === 'yearly' ? s.price / 12 : s.price
    }));
    
    // Sort by monthly price descending
    const sortedSubs = [...subsWithMonthly].sort((a, b) => b.monthlyPrice - a.monthlyPrice);
    
    // Build stacked bar for email using monthly prices
    let stackedBarHtml = sortedSubs.map((s, i) => {
      const pct = ((s.monthlyPrice / monthly_total) * 100);
      return `<td style="width:${pct}%;background:${emailColors[i % emailColors.length]};height:24px;"></td>`;
    }).join('');
    
    // Build legend rows for email
    const legendRows = sortedSubs.map((s, i) => {
      const yearlyPrice = s.monthlyPrice * 12;
      const percentage = ((s.monthlyPrice / monthly_total) * 100).toFixed(0);
      const renewalText = s.renewal_date ? ` · Renews ${new Date(s.renewal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
      const billingNote = s.billing === 'yearly' ? ` (billed $${s.price}/yr)` : '';
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e5e5;">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:12px;height:12px;background:${emailColors[i % emailColors.length]};border-radius:3px;"></td>
              <td style="padding-left:10px;font-weight:500;color:#1c1917;">${s.name}</td>
            </tr></table>
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e5e5;text-align:right;">
            <div style="font-family:monospace;font-weight:500;color:#1c1917;">$${s.monthlyPrice.toFixed(2)}/mo</div>
            <div style="font-size:12px;color:#78716c;">${percentage}% · $${yearlyPrice.toFixed(0)}/yr${billingNote}${renewalText}</div>
          </td>
        </tr>`;
    }).join('');

    // Unsubscribe URL (placeholder - would need actual domain)
    const unsubscribeUrl = `https://divergentmoney.com/unsubscribe?token=${unsubscribe_token}`;

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f4;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:#1c1917;padding:32px;text-align:center;">
      <div style="color:#d97706;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">DIVERGENT MONEY</div>
      <h1 style="color:white;font-size:28px;margin:0;font-weight:400;">Your Subscription Audit</h1>
    </div>
    
    <!-- Total -->
    <div style="padding:32px;text-align:center;border-bottom:1px solid #e5e5e5;">
      <p style="color:#78716c;margin:0 0 8px 0;font-size:14px;">You're spending</p>
      <p style="font-size:48px;font-weight:700;color:#1c1917;margin:0;font-family:monospace;">
        $${monthly_total.toFixed(2)}<span style="font-size:20px;color:#78716c;font-weight:400;">/mo</span>
      </p>
      <p style="font-size:24px;color:#d97706;font-weight:600;margin:16px 0 0 0;">
        $${Math.round(yearly_total).toLocaleString()}/year
      </p>
    </div>
    
    <!-- Stacked Bar -->
    <div style="padding:24px 32px 16px 32px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:6px;overflow:hidden;">
        <tr>${stackedBarHtml}</tr>
      </table>
    </div>
    
    <!-- Legend/Subscriptions -->
    <div style="padding:0 32px 24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        ${legendRows}
      </table>
    </div>
    
    <!-- Reminder CTA -->
    <div style="padding:24px 32px;background:#fef3c7;">
      <p style="margin:0;color:#92400e;font-weight:500;">
        📅 We'll remind you before these renew.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding:24px 32px;background:#fafaf9;text-align:center;border-top:1px solid #e5e5e5;">
      <p style="margin:0 0 8px 0;color:#78716c;font-size:12px;">
        Prices verified on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      <p style="margin:0;color:#a8a29e;font-size:11px;">
        <a href="${unsubscribeUrl}" style="color:#a8a29e;">Unsubscribe</a> · 
        <a href="https://divergentmoney.com" style="color:#a8a29e;">Divergent Money</a>
      </p>
    </div>
    
  </div>
</body>
</html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        from: 'Divergent Money <onboarding@resend.dev>',
        to: email,
        subject: `Your subscriptions: $${monthly_total.toFixed(2)}/mo ($${Math.round(yearly_total).toLocaleString()}/yr)`,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email', details: err });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
