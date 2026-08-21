/**
 * 教师问卷外网穿透服务 (Cloudflare Zero-Trust Tunnel) - 带智能自动重连与健康心跳守护
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const DATA_DIR = path.join(__dirname, 'data');
const TUNNEL_FILE = path.join(DATA_DIR, 'tunnel.json');
const CLOUDFLARED_BIN = path.join(__dirname, 'bin', 'cloudflared');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

let proc = null;
let currentTunnelUrl = '';

function startTunnel() {
  if (!fs.existsSync(CLOUDFLARED_BIN)) {
    console.error('❌ 未找到 bin/cloudflared 执行文件。');
    return;
  }

  console.log('🚀 正在拉起 Cloudflare 穿透守护进程...');
  proc = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', 'http://localhost:3000'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let found = false;

  function processOutput(data) {
    const str = data.toString();
    const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !found) {
      found = true;
      currentTunnelUrl = match[0];
      const localIp = getLocalIp();

      const info = {
        tunnelUrl: currentTunnelUrl,
        surveyUrl: `${currentTunnelUrl}/`,
        localIp: localIp,
        localUrl: `http://${localIp}:3000/`,
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(TUNNEL_FILE, JSON.stringify(info, null, 2), 'utf-8');

      // 自动推送最新隧道地址至 GitHub 仓库
      exec('git add data/tunnel.json && git commit -m "chore: auto sync active tunnel endpoint" && git push origin main', { cwd: __dirname }, (err) => {
        if (!err) {
          console.log('  ☁️ 已自动同步最新穿透地址至 GitHub Pages！');
        }
      });

      console.log('\n================================================================');
      console.log('  🎉 教师问卷外网穿透链接已就绪 (可供全场手机直接扫码填报)！');
      console.log(`  🌐 教师手机外网直连链接:   ${currentTunnelUrl}/`);
      console.log(`  📶 同一 Wi-Fi 局域网链接: http://${localIp}:3000/`);
      console.log('  🔒 权限隔离保护机制:     已开启 (外网访问大屏看板将被自动拦截)');
      console.log('================================================================\n');
    }
  }

  proc.stdout.on('data', processOutput);
  proc.stderr.on('data', processOutput);

  proc.on('close', (code) => {
    console.log(`⚠️ 穿透隧道断开 (code: ${code})，3秒后自动重新连接拉起...`);
    proc = null;
    found = false;
    setTimeout(() => {
      startTunnel();
    }, 3000);
  });
}

// 启动初始隧道
startTunnel();

// 周期性健康心跳检测（每 45 秒检测一次，防止静默掉线）
setInterval(() => {
  if (currentTunnelUrl) {
    https.get(currentTunnelUrl, (res) => {
      // healthy
    }).on('error', () => {
      console.warn('⚠️ 探测到隧道心跳异常，准备自动重连...');
      if (proc) {
        proc.kill();
      }
    });
  }
}, 45000);

process.on('SIGINT', () => {
  if (proc) proc.kill();
  process.exit();
});
