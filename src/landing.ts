export const landingPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RecruitAPI — AI Candidate Scoring</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f0f0f;
      color: #f0f0f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    a { color: #7c9eff; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Nav ── */
    nav {
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1e1e1e;
    }
    nav .logo { font-weight: 700; font-size: 18px; letter-spacing: -0.5px; }
    nav .links { display: flex; gap: 24px; font-size: 14px; color: #888; }

    /* ── Hero ── */
    .hero {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 80px 24px 60px;
    }

    .badge {
      display: inline-block;
      background: #1a1a2e;
      border: 1px solid #2e2e5e;
      color: #7c9eff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 100px;
      margin-bottom: 28px;
    }

    h1 {
      font-size: clamp(36px, 6vw, 64px);
      font-weight: 800;
      letter-spacing: -1.5px;
      line-height: 1.1;
      max-width: 720px;
      margin-bottom: 20px;
    }

    h1 span { color: #7c9eff; }

    .subtitle {
      font-size: 18px;
      color: #888;
      max-width: 520px;
      line-height: 1.6;
      margin-bottom: 48px;
    }

    /* ── Pricing card ── */
    .card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      margin-bottom: 48px;
    }

    .price {
      font-size: 52px;
      font-weight: 800;
      letter-spacing: -2px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .price-sub {
      color: #666;
      font-size: 14px;
      margin-bottom: 28px;
    }

    .features {
      list-style: none;
      text-align: left;
      margin-bottom: 32px;
    }

    .features li {
      padding: 8px 0;
      font-size: 15px;
      color: #ccc;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      border-bottom: 1px solid #1e1e1e;
    }

    .features li:last-child { border-bottom: none; }
    .features li::before { content: "✓"; color: #7c9eff; font-weight: 700; flex-shrink: 0; }

    /* ── Form ── */
    .form { display: flex; flex-direction: column; gap: 12px; }

    input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      background: #0f0f0f;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      color: #f0f0f0;
      font-size: 15px;
      outline: none;
      transition: border-color 0.15s;
    }

    input[type="email"]:focus { border-color: #7c9eff; }
    input[type="email"]::placeholder { color: #444; }

    button[type="submit"] {
      width: 100%;
      padding: 14px;
      background: #7c9eff;
      color: #0f0f0f;
      font-size: 15px;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }

    button[type="submit"]:hover { background: #9ab3ff; }
    button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }

    .form-error {
      color: #ff6b6b;
      font-size: 13px;
      display: none;
    }

    /* ── How it works ── */
    .how {
      display: flex;
      gap: 32px;
      max-width: 800px;
      margin-bottom: 64px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .step {
      flex: 1;
      min-width: 200px;
      max-width: 240px;
      text-align: center;
    }

    .step-num {
      width: 36px;
      height: 36px;
      background: #1a1a2e;
      border: 1px solid #2e2e5e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #7c9eff;
      margin: 0 auto 12px;
    }

    .step h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .step p { font-size: 13px; color: #666; line-height: 1.5; }

    /* ── Footer ── */
    footer {
      padding: 24px 40px;
      border-top: 1px solid #1e1e1e;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: #444;
      flex-wrap: wrap;
      gap: 12px;
    }
  </style>
</head>
<body>

  <nav>
    <div class="logo">RecruitAPI</div>
    <div class="links">
      <a href="https://github.com/Spaceghost99/hrmcp-server">GitHub</a>
      <a href="/health">Status</a>
    </div>
  </nav>

  <main class="hero">

    <div class="badge">MCP-native · Open source</div>

    <h1>Score candidates with<br><span>AI precision</span></h1>

    <p class="subtitle">
      One API call returns a structured score, dimension breakdown, strengths,
      and gaps — grounded in the resume and job description, not generic observations.
    </p>

    <div class="card">
      <div class="price">$5</div>
      <div class="price-sub">100 credits &nbsp;·&nbsp; valid 180 days</div>

      <ul class="features">
        <li>100 candidate scores</li>
        <li>Skills, experience, education &amp; industry dimensions</li>
        <li>Strengths and gaps per candidate</li>
        <li>Adjustable scoring weights</li>
        <li>MCP-native — works with any agent framework</li>
      </ul>

      <form class="form" id="checkout-form">
        <input type="email" id="email" placeholder="you@company.com" required autocomplete="email" />
        <div class="form-error" id="form-error"></div>
        <button type="submit" id="submit-btn">Get API key — $5</button>
      </form>
    </div>

    <div class="how">
      <div class="step">
        <div class="step-num">1</div>
        <h3>Buy credits</h3>
        <p>Pay $5 via Stripe. Your API key is issued instantly after payment.</p>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <h3>POST resume + JD</h3>
        <p>Send resume text and a job description to <code>/score-candidate</code>.</p>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <h3>Get structured scores</h3>
        <p>Receive an overall score, four dimensions, strengths, and gaps in JSON.</p>
      </div>
    </div>

  </main>

  <footer>
    <span>© 2026 RecruitAPI</span>
    <span>
      <a href="https://github.com/Spaceghost99/hrmcp-server">Open source</a>
      &nbsp;·&nbsp; Apache 2.0
    </span>
  </footer>

  <script>
    document.getElementById('checkout-form').addEventListener('submit', async function (e) {
      e.preventDefault();

      const email     = document.getElementById('email').value.trim();
      const btn       = document.getElementById('submit-btn');
      const errorEl   = document.getElementById('form-error');

      btn.disabled    = true;
      btn.textContent = 'Redirecting…';
      errorEl.style.display = 'none';

      try {
        const res  = await fetch('/checkout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email }),
        });

        const data = await res.json();

        if (!res.ok || !data.url) {
          throw new Error(data?.error?.message || 'Could not start checkout. Please try again.');
        }

        window.location.href = data.url;

      } catch (err) {
        errorEl.textContent   = err.message;
        errorEl.style.display = 'block';
        btn.disabled          = false;
        btn.textContent       = 'Get API key — $5';
      }
    });
  </script>

</body>
</html>`;
