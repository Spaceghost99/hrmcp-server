import http from 'http';
import { config } from './config';
import { handleScoreCandidate } from './tools/score-candidate/handler';

function log(event: string, data: Record<string, unknown> = {}) {
  if (config.logLevel === 'error' && event !== 'error') return;
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...data,
  }));
}

async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();

  res.setHeader('Content-Type', 'application/json');

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', model: config.anthropicModel }));
    return;
  }

  // Score candidate endpoint
  if (req.method === 'POST' && req.url === '/score-candidate') {
    let body: any;

    try {
      body = await parseBody(req);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: {
          code: 'invalid_json',
          message: 'Request body must be valid JSON.',
        }
      }));
      return;
    }

    const result = await handleScoreCandidate(body);

    log('score_request', {
      http_status: result.status,
      response_time_ms: Date.now() - startTime,
      overall_score: result.body?.overall_score ?? null,
      error_code: result.body?.error?.code ?? null,
      warnings: result.body?.warnings ?? [],
    });

    res.writeHead(result.status);
    res.end(JSON.stringify(result.body));
    return;
  }

  // 404 for everything else
  res.writeHead(404);
  res.end(JSON.stringify({
    error: {
      code: 'not_found',
      message: 'The requested endpoint does not exist.',
    }
  }));
});

server.listen(config.port, () => {
  log('server_started', {
    port: config.port,
    node_env: config.nodeEnv,
    model: config.anthropicModel,
  });
});