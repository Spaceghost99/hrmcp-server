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

    /* ── Developer sections ── */
    .dev-section {
      width: 100%;
      max-width: 860px;
      margin: 0 auto 80px;
      padding: 0 24px;
    }

    .dev-section h2 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
      text-align: center;
    }

    .dev-section .section-sub {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 32px;
    }

    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 0;
      border-bottom: 1px solid #2a2a2a;
    }

    .tab-btn {
      padding: 8px 16px;
      background: none;
      border: none;
      color: #666;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }

    .tab-btn.active { color: #7c9eff; border-bottom-color: #7c9eff; }
    .tab-btn:hover { color: #ccc; }

    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    .code-block {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-top: none;
      border-radius: 0 0 10px 10px;
      padding: 24px;
      overflow-x: auto;
      position: relative;
    }

    .code-block pre {
      font-family: "SF Mono", "Fira Code", Menlo, monospace;
      font-size: 13px;
      line-height: 1.7;
      color: #ccc;
      white-space: pre;
    }

    .copy-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: #1e1e1e;
      border: 1px solid #2a2a2a;
      color: #888;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    .copy-btn:hover { color: #f0f0f0; border-color: #444; }

    .kw  { color: #7c9eff; }   /* keywords / keys */
    .str { color: #a8e6a3; }   /* strings */
    .num { color: #ffb86c; }   /* numbers */
    .cm  { color: #555; }      /* comments */

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

  <!-- ── API quick-start ───────────────────────────────────────────────── -->
  <section class="dev-section">
    <h2>API quick-start</h2>
    <p class="section-sub">One endpoint. Pass your key in the header, get structured JSON back.</p>

    <div class="tabs">
      <button class="tab-btn active" data-tab="curl">curl</button>
      <button class="tab-btn" data-tab="python">Python</button>
      <button class="tab-btn" data-tab="node">Node.js</button>
      <button class="tab-btn" data-tab="response">Response</button>
    </div>

    <div id="tab-curl" class="tab-panel active">
      <div class="code-block">
        <button class="copy-btn" data-copy="curl">Copy</button>
        <pre><span class="kw">curl</span> -X POST https://recruitapi.app/score-candidate <span class="cm">\\</span>
  -H <span class="str">"X-API-Key: hrmcp_sk_..."</span> <span class="cm">\\</span>
  -H <span class="str">"Content-Type: application/json"</span> <span class="cm">\\</span>
  -d <span class="str">'{
    "resume_text": "...",
    "job_description": "..."
  }'</span></pre>
      </div>
    </div>

    <div id="tab-python" class="tab-panel">
      <div class="code-block">
        <button class="copy-btn" data-copy="python">Copy</button>
        <pre><span class="kw">import</span> requests

response = requests.<span class="kw">post</span>(
    <span class="str">"https://recruitapi.app/score-candidate"</span>,
    headers={<span class="str">"X-API-Key"</span>: <span class="str">"hrmcp_sk_..."</span>},
    json={
        <span class="str">"resume_text"</span>: <span class="str">"..."</span>,
        <span class="str">"job_description"</span>: <span class="str">"..."</span>,
    }
)
data = response.json()
<span class="kw">print</span>(data[<span class="str">"overall_score"</span>])</pre>
      </div>
    </div>

    <div id="tab-node" class="tab-panel">
      <div class="code-block">
        <button class="copy-btn" data-copy="node">Copy</button>
        <pre><span class="kw">const</span> res = <span class="kw">await</span> fetch(<span class="str">"https://recruitapi.app/score-candidate"</span>, {
  method: <span class="str">"POST"</span>,
  headers: {
    <span class="str">"X-API-Key"</span>: <span class="str">"hrmcp_sk_..."</span>,
    <span class="str">"Content-Type"</span>: <span class="str">"application/json"</span>,
  },
  body: JSON.stringify({
    resume_text: <span class="str">"..."</span>,
    job_description: <span class="str">"..."</span>,
  }),
});
<span class="kw">const</span> data = <span class="kw">await</span> res.json();
console.log(data.overall_score);</pre>
      </div>
    </div>

    <div id="tab-response" class="tab-panel">
      <div class="code-block">
        <pre>{
  <span class="kw">"overall_score"</span>: <span class="num">82</span>,
  <span class="kw">"dimension_scores"</span>: {
    <span class="kw">"skills_match"</span>:        <span class="num">88</span>,
    <span class="kw">"experience"</span>:          <span class="num">85</span>,
    <span class="kw">"industry_background"</span>: <span class="num">74</span>,
    <span class="kw">"education"</span>:           <span class="num">70</span>
  },
  <span class="kw">"strengths"</span>: [
    <span class="str">"Five years of Python in production ML pipelines"</span>,
    <span class="str">"Led team of 8 through platform migration"</span>
  ],
  <span class="kw">"gaps"</span>: [
    <span class="str">"No Kubernetes experience"</span>,
    <span class="str">"MBA preferred; candidate holds a BS"</span>
  ],
  <span class="kw">"recency_window_used"</span>: <span class="num">10</span>,
  <span class="kw">"model"</span>: <span class="str">"claude-sonnet-4-20250514"</span>,
  <span class="kw">"warnings"</span>: []
}</pre>
      </div>
    </div>
  </section>

  <!-- ── MCP / agent config ─────────────────────────────────────────────── -->
  <section class="dev-section">
    <h2>Use with AI agents</h2>
    <p class="section-sub">RecruitAPI speaks MCP natively. Add it to any compatible agent framework in seconds.</p>

    <div class="tabs">
      <button class="tab-btn active" data-tab="claude">Claude Desktop</button>
      <button class="tab-btn" data-tab="cursor">Cursor</button>
      <button class="tab-btn" data-tab="http">HTTP (any framework)</button>
    </div>

    <div id="tab-claude" class="tab-panel active">
      <div class="code-block">
        <button class="copy-btn" data-copy="claude">Copy</button>
        <pre><span class="cm">// claude_desktop_config.json</span>
{
  <span class="kw">"mcpServers"</span>: {
    <span class="kw">"recruitapi"</span>: {
      <span class="kw">"url"</span>: <span class="str">"https://recruitapi.app"</span>,
      <span class="kw">"headers"</span>: {
        <span class="kw">"X-API-Key"</span>: <span class="str">"hrmcp_sk_..."</span>
      }
    }
  }
}</pre>
      </div>
    </div>

    <div id="tab-cursor" class="tab-panel">
      <div class="code-block">
        <button class="copy-btn" data-copy="cursor">Copy</button>
        <pre><span class="cm">// .cursor/mcp.json</span>
{
  <span class="kw">"mcpServers"</span>: {
    <span class="kw">"recruitapi"</span>: {
      <span class="kw">"url"</span>: <span class="str">"https://recruitapi.app"</span>,
      <span class="kw">"headers"</span>: {
        <span class="kw">"X-API-Key"</span>: <span class="str">"hrmcp_sk_..."</span>
      }
    }
  }
}</pre>
      </div>
    </div>

    <div id="tab-http" class="tab-panel">
      <div class="code-block">
        <pre><span class="cm"># Any agent that can make HTTP requests can call RecruitAPI directly.
# No MCP SDK required. Pass your key and POST to the endpoint.</span>

<span class="kw">POST</span> https://recruitapi.app/score-candidate
<span class="kw">X-API-Key:</span> hrmcp_sk_...
<span class="kw">Content-Type:</span> application/json

{
  <span class="kw">"resume_text"</span>: <span class="str">"..."</span>,
  <span class="kw">"job_description"</span>: <span class="str">"..."</span>
}</pre>
      </div>
    </div>
  </section>

  <footer>
    <span>© 2026 RecruitAPI</span>
    <span>
      <a href="https://github.com/Spaceghost99/hrmcp-server">Open source</a>
      &nbsp;·&nbsp; <a href="https://github.com/Spaceghost99/hrmcp-server/blob/main/LICENSE">Source Available</a>
    </span>
  </footer>

  <script>
    // ── Tab switching ──────────────────────────────────────────────────────────
    document.querySelectorAll('.tabs').forEach(function (tabGroup) {
      tabGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;

        const section = tabGroup.closest('.dev-section');
        section.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        section.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });

        btn.classList.add('active');
        const panelId = 'tab-' + btn.dataset.tab;
        const panel = section.querySelector('#' + panelId);
        if (panel) panel.classList.add('active');
      });
    });

    // ── Copy buttons ───────────────────────────────────────────────────────────
    const copyTexts = {
      curl:   'curl -X POST https://recruitapi.app/score-candidate \\\n  -H "X-API-Key: hrmcp_sk_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"resume_text": "...", "job_description": "..."}\'',
      python: 'import requests\n\nresponse = requests.post(\n    "https://recruitapi.app/score-candidate",\n    headers={"X-API-Key": "hrmcp_sk_..."},\n    json={"resume_text": "...", "job_description": "..."}\n)\ndata = response.json()\nprint(data["overall_score"])',
      node:   'const res = await fetch("https://recruitapi.app/score-candidate", {\n  method: "POST",\n  headers: {\n    "X-API-Key": "hrmcp_sk_...",\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({ resume_text: "...", job_description: "..." }),\n});\nconst data = await res.json();\nconsole.log(data.overall_score);',
      claude: '{\n  "mcpServers": {\n    "recruitapi": {\n      "url": "https://recruitapi.app",\n      "headers": { "X-API-Key": "hrmcp_sk_..." }\n    }\n  }\n}',
      cursor: '{\n  "mcpServers": {\n    "recruitapi": {\n      "url": "https://recruitapi.app",\n      "headers": { "X-API-Key": "hrmcp_sk_..." }\n    }\n  }\n}',
    };

    document.querySelectorAll('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key  = btn.dataset.copy;
        const text = copyTexts[key];
        if (!text) return;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
        });
      });
    });

    // ── Checkout form ──────────────────────────────────────────────────────────
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
