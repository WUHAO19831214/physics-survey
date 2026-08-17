# 系统架构与讲座现场高可用应急指南
**Architecture & Disaster Recovery Guide**

---

## 1. 系统架构设计

```
[教师手机端浏览器]  ---(HTTP POST /api/submit)--->  [Node.js 零依赖服务 :3000]
       |                                                    |
 (LocalStorage 离线备份)                          (读写 data/<sessionId>.json)
                                                            |
[讲师大屏 Dashboard] <---(HTTP GET /api/data)----------------+
       |
       +---> [ECharts 地图 / 5维雷达 / 漏斗 / 排行榜]
       +---> [本地 Ollama 11434 (优先) 或 本地离线规则分词 (兜底)]
       +---> [学术研究脱敏 CSV / 全量 JSON 导出]
```

---

## 2. 讲座现场网络模式与访问方案

### 方案 A：局域网 WiFi / 手机热点直连（最推荐，零公网依赖）
1. 讲师电脑连接现场 WiFi 或开启 iPhone/手机热点。
2. 运行 `./start.sh`，终端将打印出类似 `http://192.168.1.100:3000/`。
3. 讲师使用任何在线二维码生成工具（如 cli.im）或在看板上生成该链接的二维码。
4. 参训教师手机连入同一 WiFi/热点，扫码即可秒级打开填报，数据直存讲师电脑。

### 方案 B：公网轻量隧道（如需公网访问）
如教师使用自身 4G/5G 流量且未连接同一 WiFi：
```bash
# 使用任意轻量穿透工具（备选）
npx localtunnel --port 3000
# 或
cloudflared tunnel --url http://localhost:3000
```

---

## 3. 现场断网与故障应急保障 (Disaster Recovery)

* **情景 1：完全断网（无外网连接）**
  * Node.js 服务、静态 HTML/CSS/JS、ECharts 核心库与 Shanghai GeoJSON 均支持完全离线运行。
  * AI 建议面板自动降级为 **“本地离线规则分词聚类引擎”**，100% 保证现场不报错、不卡顿。
* **情景 2：教师手机误刷新**
  * 问卷前端内置 `localStorage` 实时暂存，刷新后已填写内容自动恢复，不会丢失。
* **情景 3：教师手机网络闪断**
  * 提交时若服务端连接超时，数据先自动留存手机本地 `ai_teacher_survey_submissions_local`，保障数据安全。
