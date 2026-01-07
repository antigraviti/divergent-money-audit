module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, subscriptions, monthly_total, yearly_total, currency = 'USD', currency_symbol = '$', price_corrections = [] } = req.body;
    if (!email || !subscriptions) return res.status(400).json({ error: 'Email and subscriptions required' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    // Log price corrections (crowdsourced data)
    if (price_corrections.length > 0) {
      const correctionsPayload = price_corrections.map(pc => ({
        service_name: pc.service_name,
        original_price: pc.original_price,
        corrected_price: pc.corrected_price,
        currency: currency
      }));
      
      await fetch(`${supabaseUrl}/rest/v1/price_corrections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(correctionsPayload)
      }).catch(err => console.error('Price corrections logging error:', err));
    }

    // Cancellation data: method, difficulty (1=easy, 2=medium, 3=hard), instructions, phone if needed
    const cancelData = {
      'Netflix': { method: 'Website', difficulty: 1, instructions: 'Account → Cancel Membership', url: 'https://www.netflix.com/cancelplan' },
      'Hulu': { method: 'Website', difficulty: 1, instructions: 'Account → Cancel', url: 'https://secure.hulu.com/account' },
      'Disney+': { method: 'Website', difficulty: 1, instructions: 'Account → Subscription → Cancel', url: 'https://www.disneyplus.com/account' },
      'Max': { method: 'Website', difficulty: 1, instructions: 'Settings → Subscription → Cancel', url: 'https://www.max.com/settings' },
      'Prime Video': { method: 'Website', difficulty: 2, instructions: 'Amazon → Account → Prime Membership → End', url: 'https://www.amazon.com/mc' },
      'Apple TV+': { method: 'App/Website', difficulty: 2, instructions: 'Settings → Apple ID → Subscriptions', url: 'https://support.apple.com/en-us/HT202039' },
      'Peacock': { method: 'Website', difficulty: 1, instructions: 'Account → Plan → Cancel', url: 'https://www.peacocktv.com/account' },
      'Paramount+': { method: 'Website', difficulty: 1, instructions: 'Account → Cancel Subscription', url: 'https://www.paramountplus.com/account/' },
      'YouTube Premium': { method: 'Website', difficulty: 1, instructions: 'Settings → Purchases → Manage memberships', url: 'https://www.youtube.com/paid_memberships' },
      'Spotify': { method: 'Website', difficulty: 1, instructions: 'Account → Plan → Cancel', url: 'https://www.spotify.com/account/' },
      'Apple Music': { method: 'App/Website', difficulty: 2, instructions: 'Settings → Apple ID → Subscriptions', url: 'https://support.apple.com/en-us/HT202039' },
      'Audible': { method: 'Website', difficulty: 2, instructions: 'Account → Cancel membership (keep credits!)', url: 'https://www.audible.com/account' },
      'Adobe CC': { method: 'Website', difficulty: 3, instructions: 'Account → Plans → Manage plan → Cancel', phone: '1-800-833-6687', url: 'https://account.adobe.com/plans' },
      'Microsoft 365': { method: 'Website', difficulty: 2, instructions: 'Account → Services → Cancel', url: 'https://account.microsoft.com/services' },
      'iCloud+': { method: 'App/Website', difficulty: 2, instructions: 'Settings → Apple ID → Subscriptions', url: 'https://support.apple.com/en-us/HT202039' },
      'ChatGPT Plus': { method: 'Website', difficulty: 1, instructions: 'Settings → Subscription → Cancel', url: 'https://chat.openai.com/' },
      'Claude Pro': { method: 'Website', difficulty: 1, instructions: 'Settings → Subscription → Cancel', url: 'https://claude.ai/settings' },
      'Dropbox': { method: 'Website', difficulty: 2, instructions: 'Settings → Plan → Cancel', url: 'https://www.dropbox.com/account/plan' },
      '1Password': { method: 'Website', difficulty: 1, instructions: 'Account → Billing → Cancel', url: 'https://my.1password.com/settings/billing' },
      'Amazon Prime': { method: 'Website', difficulty: 2, instructions: 'Account → Prime → End Membership', url: 'https://www.amazon.com/mc' },
      'Costco': { method: 'In-store/Phone', difficulty: 2, instructions: 'Visit membership desk or call', phone: '1-800-774-2678' },
      'Walmart+': { method: 'Website', difficulty: 1, instructions: 'Account → Walmart+ → Cancel', url: 'https://www.walmart.com/account/wplus' },
      'DashPass': { method: 'App/Website', difficulty: 1, instructions: 'Account → Manage DashPass → Cancel', url: 'https://www.doordash.com/consumer/membership/' },
      'Uber One': { method: 'App', difficulty: 1, instructions: 'Account → Uber One → Manage → Cancel' },
      'Instacart+': { method: 'Website', difficulty: 1, instructions: 'Account → Instacart+ → Cancel', url: 'https://www.instacart.com/store/account/instacart-plus' },
      'Xbox Game Pass': { method: 'Website', difficulty: 2, instructions: 'Account → Services → Cancel', url: 'https://account.microsoft.com/services' },
      'PlayStation Plus': { method: 'Console/Website', difficulty: 2, instructions: 'Settings → Account → Subscriptions → Cancel', url: 'https://www.playstation.com/acct/management' },
      'Nintendo Online': { method: 'Console/Website', difficulty: 2, instructions: 'eShop → Account → Subscriptions', url: 'https://accounts.nintendo.com/' },
      'EA Play': { method: 'Website', difficulty: 2, instructions: 'Account → EA Play → Cancel', url: 'https://myaccount.ea.com/cp-ui/subscriptions' },
      'Gym Membership': { method: 'Varies', difficulty: 3, instructions: 'Usually requires in-person visit or certified letter' },
      'Peloton': { method: 'Website', difficulty: 2, instructions: 'Account → Subscriptions → Cancel', url: 'https://members.onepeloton.com/preferences' },
      'Headspace': { method: 'Website', difficulty: 1, instructions: 'Settings → Subscription → Cancel', url: 'https://www.headspace.com/settings' },
      'Strava': { method: 'Website', difficulty: 1, instructions: 'Settings → Subscription → Cancel', url: 'https://www.strava.com/settings/subscription' },
      'New York Times': { method: 'Phone/Chat', difficulty: 3, instructions: 'Must call or chat to cancel', phone: '1-800-698-4637', url: 'https://help.nytimes.com/hc/en-us/articles/115014893968-Cancel-your-subscription' },
      'Wall Street Journal': { method: 'Phone/Chat', difficulty: 3, instructions: 'Must call or chat to cancel', phone: '1-800-568-7625' },
      'The Athletic': { method: 'Website', difficulty: 2, instructions: 'Account → Manage → Cancel', url: 'https://theathletic.com/settings' },
      'Duolingo Plus': { method: 'App/Website', difficulty: 1, instructions: 'Settings → Super Duolingo → Cancel', url: 'https://www.duolingo.com/settings/account' }
    };
    
    const difficultyLabels = { 1: '🟢 Easy', 2: '🟡 Medium', 3: '🔴 Hard' };

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
        currency,
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
      const billingNote = s.billing === 'yearly' ? ` (billed ${currency_symbol}${s.price}/yr)` : '';
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e5e5;">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:12px;height:12px;background:${emailColors[i % emailColors.length]};border-radius:3px;"></td>
              <td style="padding-left:10px;font-weight:500;color:#1c1917;">${s.name}</td>
            </tr></table>
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e5e5;text-align:right;">
            <div style="font-family:monospace;font-weight:500;color:#1c1917;">${currency_symbol}${s.monthlyPrice.toFixed(2)}/mo</div>
            <div style="font-size:12px;color:#78716c;">${percentage}% · ${currency_symbol}${yearlyPrice.toFixed(0)}/yr${billingNote}${renewalText}</div>
          </td>
        </tr>`;
    }).join('');
    
    // Build cancellation guide rows
    const cancelRows = sortedSubs.map(s => {
      const cancel = cancelData[s.name] || { method: 'Check account settings', difficulty: 2, instructions: 'Look for Cancel or Subscription settings' };
      const difficulty = difficultyLabels[cancel.difficulty] || '🟡 Medium';
      const phoneText = cancel.phone ? `<br><span style="font-size:11px;">📞 ${cancel.phone}</span>` : '';
      const linkText = cancel.url ? `<a href="${cancel.url}" style="color:#d97706;text-decoration:none;font-size:11px;">Open settings →</a>` : '';
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;">
            <div style="font-weight:500;color:#1c1917;margin-bottom:2px;">${s.name}</div>
            <div style="font-size:12px;color:#78716c;">${cancel.method} · ${difficulty}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;text-align:left;">
            <div style="font-size:12px;color:#57534e;">${cancel.instructions}${phoneText}</div>
            ${linkText}
          </td>
        </tr>`;
    }).join('');

    // Unsubscribe URL
    const unsubscribeUrl = `https://divergentmoney.com/unsubscribe?token=${unsubscribe_token}`;
    
    // Feedback email with pre-filled subject
    const feedbackEmail = `hello@divergentmoney.com?subject=Cancellation%20Feedback&body=Service%20name:%0A%0AWhat%20happened:%0A%0A`;

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
        ${currency_symbol}${monthly_total.toFixed(2)}<span style="font-size:20px;color:#78716c;font-weight:400;">/mo</span>
      </p>
      <p style="font-size:24px;color:#d97706;font-weight:600;margin:16px 0 0 0;">
        ${currency_symbol}${Math.round(yearly_total).toLocaleString()}/year
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
    
    <!-- Cancellation Guide -->
    <div style="padding:24px 32px;">
      <h2 style="font-size:18px;font-weight:600;color:#1c1917;margin:0 0 8px 0;">How to Cancel</h2>
      <p style="font-size:13px;color:#78716c;margin:0 0 16px 0;">Ready to cut something? Here's how:</p>
      <table style="width:100%;border-collapse:collapse;">
        ${cancelRows}
      </table>
    </div>
    
    <!-- Feedback -->
    <div style="padding:20px 32px;background:#f5f5f4;border-top:1px solid #e5e5e5;">
      <p style="margin:0;font-size:13px;color:#57534e;text-align:center;">
        Had trouble canceling? Link broken? <a href="mailto:${feedbackEmail}" style="color:#d97706;">Let us know</a> — we'll update our guide.
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
        from: 'Divergent Money <hello@divergentmoney.com>',
        to: email,
        subject: `Your subscriptions: ${currency_symbol}${monthly_total.toFixed(2)}/mo (${currency_symbol}${Math.round(yearly_total).toLocaleString()}/yr)`,
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
