/**
 * 教师问卷外网穿透服务 (Cloudflare Zero-Trust Tunnel)
 * 作用：生成全球可访问的独立 HTTPS 问卷链接，手机在 4G/5G/微信/Safari 中均可直接打开并实时回传数据
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

console.log('================================================================');
console.log('  🚀 正在启动教师问卷外网安全穿透隧道...');
console.log('================================================================');

if (!fs.existsSync(CLOUDFLARED_BIN)) {
  console.error('❌ 未找到 bin/cloudflared 执行文件，请检查是否已安装。');
  process.exit(1);
}

const proc = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let found = false;

function processOutput(data) {
  const str = data.toString();
  const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !found) {
    found = true;
    const tunnelUrl = match[0];
    const localIp = getLocalIp();

    const info = {
      tunnelUrl: tunnelUrl,
      surveyUrl: `${tunnelUrl}/`,
      localIp: localIp,
      localUrl: `http://${localIp}:3000/`,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(TUNNEL_FILE, JSON.stringify(info, null, 2), 'utf-8');

    // 自动推送最新隧道地址至 GitHub 仓库
    const { exec } = require('child_process');
    exec('git add data/tunnel.json && git commit -m "chore: auto sync active tunnel endpoint" && git push origin main', { cwd: __dirname }, (err) => {
      if (!err) {
        console.log('  ☁️ 已自动同步最新穿透地址至 GitHub Pages！');
      }
    });

    console.log('\n================================================================');
    console.log('  🎉 教师问卷外网穿透链接已就绪 (可供全场手机直接扫码填报)！');
    console.log(`  🌐 教师手机外网直连链接:   ${tunnelUrl}/`);
    console.log(`  📶 同一 Wi-Fi 局域网链接: http://${localIp}:3000/`);
    console.log('  🔒 权限隔离保护机制:     已开启 (外网访问大屏看板将被自动拦截)');
    console.log('================================================================\n');
  }
}

proc.stdout.on('data', processOutput);
proc.stderr.on('data', processOutput);

proc.on('close', (code) => {
  console.log(`\n穿透隧道进程已退出 (code: ${code})`);
});

process.on('SIGINT', () => {
  proc.kill();
  process.exit();
});
