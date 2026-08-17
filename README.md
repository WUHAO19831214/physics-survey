# 物理教师 AI 创新能力画像与实验开发需求调查平台
**AI Teacher Innovation Survey & Research Dashboard (v2.0)**

> 服务于教师研训现场实时互动、讲座策略动态调优与长期区域教研课题数据积累。

---

## 🌟 核心特性

1. **零外部依赖 (Zero-Dependency)**：基于 Node.js 原生模块构建，无需繁琐的 `npm install`，开箱即用。
2. **移动端分步式向导 (Mobile Wizard)**：
   * 6 步直观卡片向导（基本信息、AI工具、5级能力量表、实验痛点、创新项目、开放期望）。
   * 专为触控优化的大号胶囊选项、预填快速标签与防刷新自动暂存。
3. **讲师实时大屏指挥看板 (Real-time Dashboard)**：
   * **崇明 / 上海两级联动地图**：动态呈现参训教师学校热点与区域分布。
   * **5 维 AI 创新能力雷达图**：标准化 0–100 指数模型（教学内容、多媒体课件、学情数据、编程开发、物理实验创新）。
   * **实验数字化需求与 AI 工具排行**：动态掌握现场教师核心诉求。
   * **创新项目阶段漏斗**：从构思、尝试到课堂应用的进阶分布。
4. **双引擎 AI 智能讲座建议**：
   * 优先接入本地 **Ollama (11434)** 大模型深度研判。
   * 搭载完全离线的 **本地规则分词聚类引擎**，断网环境下依然稳定输出“建议加强/降低”的讲座调优策略。
5. **长期科研多批次数据架构 (Multi-Session)**：
   * 支持通过 `sessionId` 隔离不同年份与研训批次（如崇明、贵州、长宁等）。
   * 支持一键导出全量 CSV / JSON，以及学术论文专用的 **“匿名脱敏 CSV”**。

---

## 🚀 快速启动

### 方式 1：终端一键启动
```bash
chmod +x start.sh
./start.sh
```

### 方式 2：Node.js 命令启动
```bash
node server.js
```

启动后控制台将输出：
* **手机填报地址**：`http://localhost:3000/` （同局域网 WiFi 输入电脑局域网 IP 即可访问）
* **讲师看板地址**：`http://localhost:3000/dashboard`

---

## 📁 目录结构

```text
AI-Teacher-Innovation-Survey wonderful-bohr2/
├── docs/
│   ├── scoring-method.md          # 5 维能力画像量化评估算法标准（论文引用规范）
│   └── architecture.md            # 系统架构、网络方案与断网应急指南
├── public/                        # 静态资源与地图
│   ├── maps/
│   │   ├── shanghai.json          # 上海市区级 GeoJSON 地图数据
│   │   ├── chongming-schools.json # 崇明区学校坐标字典
│   │   └── china.json             # 全国省级 GeoJSON（跨省比较备用）
│   ├── css/
│   │   ├── style.css              # 全局设计系统与暗色科技风 Token
│   │   ├── mobile.css             # 移动端向导与 5 级量表专属样式
│   │   └── dashboard.css          # 大屏看板三栏 Grid 布局样式
│   └── js/
│       ├── survey.js              # 手机问卷交互、校验与本地暂存
│       ├── dashboard.js           # 看板图表渲染与数据轮询
│       ├── radar-calculator.js    # 5 维能力指数标准化算法
│       └── ai-analyser.js         # Ollama + 离线规则双引擎文本挖掘
├── data/                          # 多批次数据存储目录
│   ├── sessions.json              # 培训批次元数据索引
│   └── 2026-chongming-ai-physics.json # 2026崇明培训批次数据
├── index.html                     # 教师手机端问卷填报入口
├── dashboard.html                 # 讲师实时大屏看板入口
├── server.js                      # 零依赖核心后端服务
├── start.sh                       # 快速启动与局域网 IP 探测脚本
├── package.json                   # 项目元数据
└── README.md                      # 项目文档
```

---

## 📊 学术研究量化模型

详细算法请参阅 [`docs/scoring-method.md`](docs/scoring-method.md)。

* 原始 5 级评分 $S_i \in \{1, 2, 3, 4, 5\}$
* 线性标准指数：$I_i = (S_i - 1) \times 25 \quad (0 \le I_i \le 100)$
* 综合创新指数：$\text{AICP}_{\text{overall}} = \frac{1}{5} \sum_{i=1}^{5} I_i$
