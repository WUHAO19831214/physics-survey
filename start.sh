#!/bin/bash

echo "====================================================================="
echo "  🚀 启动物理教师 AI 创新能力画像与实验开发需求调查平台..."
echo "====================================================================="

# 获取本机局域网 IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo "  👉 手机填报地址 (局域网同WiFi可访问): http://${LOCAL_IP}:3000/"
echo "  👉 讲师大屏看板: http://localhost:3000/dashboard"
echo "====================================================================="

node server.js
