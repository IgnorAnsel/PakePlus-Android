const { spawn } = require('child_process');
const { server } = require('./serve-client');

const preferredPort = Number(process.env.CLIENT_PORT || 8080);
const maxPort = preferredPort + 20;

function start(port = preferredPort) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < maxPort) {
      console.log(`端口 ${port} 已被占用，尝试端口 ${port + 1}...`);
      start(port + 1);
      return;
    }
    console.error(`客户端启动失败：${error.message}`);
    process.exit(1);
  });

  server.listen(port, () => openTunnel(port));
}

function openTunnel(port) {
  console.log(`食刻客户端已启动：http://localhost:${port}`);

  const tunnel = spawn('ssh', [
    '-T',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', `80:127.0.0.1:${port}`,
    'nokey@localhost.run'
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  const print = (chunk) => {
    const message = chunk.toString();
    const url = message.match(/https:\/\/[a-z0-9.-]+\.lhr\.life/i)?.[0];
    if (url) console.log(`公网地址：${url}`);
    else if (/error|failed|denied/i.test(message)) process.stderr.write(message);
  };

  tunnel.stdout.on('data', print);
  tunnel.stderr.on('data', print);
  tunnel.on('error', (error) => console.error(`无法启动公网隧道：${error.message}`));
  tunnel.on('exit', (code) => {
    if (code) console.error(`公网隧道已退出，代码：${code}`);
  });

  const close = () => {
    tunnel.kill();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

start();
