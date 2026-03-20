# Contributing to hrmcp-server

Bug reports, fixes, and new HR/recruiting tools are welcome. Read this before opening a PR.

---

## Dev setup

```bash
git clone https://github.com/Spaceghost99/hrmcp-server.git
cd hrmcp-server
npm install
cp .env.example .env
```

Fill in `.env` at minimum:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`DATABASE_URL`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are only required if you're working on auth, billing, or the webhook handler. Scoring works without them.

Start the dev server:

```bash
npm run dev
```

Typecheck without running:

```bash
npm run typecheck
```

---

## Running the test fixtures

There is no test runner yet — fixtures are run manually against the live server. All three must pass before a PR touching the scoring engine or prompt is merged.

Start the server, then run each fixture with `curl` or any HTTP client.

### Fixture 1 — Strong recent candidate (Jordan Lee)

```bash
curl -s -X POST http://localhost:3000/score-candidate \
  -H "Content-Type: application/json" \
  -d '{
    "resume_text": "Jordan Lee\nSenior Software Engineer\n\n2019–present: Staff Engineer, Acme Corp. Led migration of monolith to microservices. Python, Go, Kubernetes, Postgres. Team of 8.\n2016–2019: Software Engineer, Beta Inc. Built ML data pipelines in Python. Reduced processing time 60%.\n\nBS Computer Science, State University, 2016.",
    "job_description": "Senior backend engineer. Required: Python, 5+ years experience, team leadership. Preferred: Kubernetes, Go."
  }'
```

Expected: `overall_score` 78–88, `experience` 85+, `skills_match` 85+, `warnings` empty, `strengths` reference specific recent experience.

### Fixture 2 — No dates on resume (Maria Santos)

```bash
curl -s -X POST http://localhost:3000/score-candidate \
  -H "Content-Type: application/json" \
  -d '{
    "resume_text": "Maria Santos\nData Scientist\n\nExperience: Built predictive churn models using scikit-learn and XGBoost. Delivered dashboards in Tableau. Worked with SQL and Spark on large datasets.\n\nEducation: MS Statistics, City University.",
    "job_description": "Data Scientist with 3+ years experience. Required: Python, machine learning, SQL. Preferred: Spark, recent industry experience."
  }'
```

Expected: `experience` dimension noticeably lower than `skills_match`, `gaps` mentions missing dates, model does not assume recency.

### Fixture 3 — Missing required skill (Alex Kim)

```bash
curl -s -X POST http://localhost:3000/score-candidate \
  -H "Content-Type: application/json" \
  -d '{
    "resume_text": "Alex Kim\nSoftware Engineer\n\n2021–present: Backend Engineer, Gamma Ltd. Java, Spring Boot, MySQL, REST APIs. Designed internal tooling used by 200+ employees.\n2019–2021: Junior Developer, Delta Co. Java, JavaScript.\n\nBS Information Systems, 2019.",
    "job_description": "Backend engineer. Required: Python, Java, REST APIs. Preferred: AWS, Docker."
  }'
```

Expected: `overall_score` does not exceed 75, `gaps` explicitly names Python, `skills_match` lower than other dimensions.

---

## Pull request process

1. **Open an issue first** for anything beyond a small bug fix. Describe what you want to change and why — it avoids wasted effort if the direction isn't right.

2. **Branch from `main`:**
   ```bash
   git checkout -b your-feature-name
   ```

3. **Keep PRs focused.** One change per PR. A billing fix and a new scoring tool in the same PR will be asked to split.

4. **All three fixtures must pass** if your change touches:
   - `src/tools/score-candidate/` (any file)
   - `src/middleware/` (any file)
   - `src/index.ts`

5. **Typecheck must be clean:**
   ```bash
   npm run typecheck
   ```

6. **Do not commit:**
   - `.env` or any file containing real API keys
   - `dist/` — it's in `.gitignore` and built by Railway
   - `node_modules/`

7. Submit the PR against `main`. Describe what the change does and how you verified it.

---

## Adding a new tool

Tools live in `src/tools/<tool-name>/`. Each tool is self-contained:

```
src/tools/your-tool/
  handler.ts    — input validation, orchestration, response shaping
  scorer.ts     — Anthropic API call and response parsing
  schema.ts     — Zod schemas, types, and defaults
  prompt.ts     — system prompt and user prompt builder
```

Steps:

1. Create the directory and four files following the `score-candidate` pattern.
2. Add a route in `src/index.ts` — auth, rate limit, credit deduction, and logging already apply to any route you add in the `POST` handler block.
3. Add the tool to the error code list in `src/errors/codes.ts` if it introduces new failure modes.
4. Write at least three test fixtures (passing, edge case, failure case) and document them in your PR.

---

## Code conventions

- TypeScript strict mode is on — no `any` escapes without a comment explaining why
- No `console.log` in production paths — use `logRequest` or `logBillingEvent` from `src/middleware/logger.ts`; write to `process.stderr` for unexpected errors
- Errors always use `createError` from `src/errors/envelope.ts` — never return raw exception messages to the caller
- New environment variables go in `src/config.ts` and `.env.example` in the same commit
- Comments explain *why*, not *what* — the code shows what

---

## Questions

Open a GitHub issue. Tag it `question`.
