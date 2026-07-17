const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.CLIENT_PORT || 8080);
const API_URL = new URL(process.env.API_URL || 'http://localhost:3000');
const ROOT = __dirname;
const CLIENT_FILES = new Set(['/index.html', '/app.js', '/style.css']);
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (pathname === '/health' || pathname.startsWith('/api/')) {
    const proxy = http.request({
      hostname: API_URL.hostname,
      port: API_URL.port || 80,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: API_URL.host }
    }, (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    proxy.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '无法连接服务器端，请确认 server 已启动' }));
    });
    req.pipe(proxy);
    return;
  }

  const requested = pathname === '/' ? '/index.html' : pathname;

  if (!CLIENT_FILES.has(requested)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const file = path.join(ROOT, requested.slice(1));
  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': CONTENT_TYPES[path.extname(file)]
  });
  fs.createReadStream(file).pipe(res);
});

if (require.main === module) {
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`端口 ${PORT} 已被占用，请先关闭已有客户端或设置 CLIENT_PORT。`);
      process.exit(1);
    }
    throw error;
  });
  server.listen(PORT, () => console.log(`食刻客户端已启动：http://localhost:${PORT}`));
}

module.exports = { server };
