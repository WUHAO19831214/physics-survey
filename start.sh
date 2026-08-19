#!/bin/bash

# 物理教师 AI 创新能力画像与实验开发需求调查平台
# 一键启动服务与公网安全穿透脚本

cd "$(dirname "$0")"

echo "================================================================="
echo "  🚀 正在启动 物理教师 AI 创新画像平台 (本地服务 + 外网穿透)..."
echo "================================================================="

# 检查 Node 环境
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查端口占用并释放
PORT=3000
PID=$(lsof -ti :$PORT)
if [ -n "$PID" ]; then
    echo "⚠️  端口 $PORT 已被进程 $PID 占用，正在释放..."
    kill -9 $PID 2>/dev/null
fi

# 1. 后台启动 Node.js 服务
node server.js &
NODE_PID=$!
sleep 1

# 2. 启动外网穿透服务
echo "🌐 正在启动 Cloudflare Zero-Trust 穿透隧道..."
node tunnel.js &
TUNNEL_PID=$!

echo "================================================================="
echo "  🎉 系统已全部就绪！"
echo "  🖥️  讲师大屏看板:   http://localhost:3000/dashboard"
echo "  📱 局域网内网问卷: http://$(ipconfig getifaddr en0 2>/dev/null || echo '127.0.0.1'):3000/"
echo "  🌐 外网 HTTPS 问卷: 正在从 Cloudflare 节点生成 (可在看板弹窗中一键查看复制)"
echo "================================================================="

# 优雅退出捕获
trap "kill $NODE_PID $TUNNEL_PID 2>/dev/null; echo '服务已安全关闭'; exit" SIGINT SIGTERM

wait
