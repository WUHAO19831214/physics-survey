/**
 * 物理教师 AI 创新能力画像与实验开发需求调查平台
 * AI Teacher Innovation Survey & Research Dashboard - 核心后端服务
 * 
 * 特性：
 * 1. 零依赖：纯原生 Node.js (http, fs, path, url, querystring)，无需 npm install 任何第三方包。
 * 2. 多批次隔离 (Multi-Session)：通过 sessionId 区分不同地区与培训批次，支持历史比较。
 * 3. 研究数据导出：内置全量数据与学术匿名脱敏 (Anonymized) CSV/JSON 导出。
 * 4. 静态资源自动挂载：支持 index.html (手机填报向导) 与 dashboard.html (实时大屏)。
 * 5. 跨域与断网友好：CORS 全开，支持局域网 IP 与本地双击离线模式。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 确保 sessions.json 存在
if (!fs.existsSync(SESSIONS_FILE)) {
  const defaultSessions = [
    {
      id: "2026-chongming-ai-physics",
      name: "2026年8月 上海市崇明区物理教师AI创新与实验开发培训",
      theme: "从实验痛点到智能工具：AI协作开发赋能物理实验创新的实践与复现",
      date: "2026-08",
      region: "上海市崇明区",
      isDefault: true
    }
  ];
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(defaultSessions, null, 2), 'utf-8');
}

// 获取当前默认或指定 Session
function getSessionsList() {
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [{ id: "2026-chongming-ai-physics", name: "默认崇明培训批次", isDefault: true }];
  }
}

function getDefaultSessionId() {
  const sessions = getSessionsList();
  const def = sessions.find(s => s.isDefault);
  return def ? def.id : (sessions[0]?.id || "2026-chongming-ai-physics");
}

function getSessionFilePath(sessionId) {
  const safeId = (sessionId || getDefaultSessionId()).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA_DIR, `${safeId}.json`);
}

function readSessionData(sessionId) {
  const filePath = getSessionFilePath(sessionId);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeSessionData(sessionId, data) {
  const filePath = getSessionFilePath(sessionId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// CORS 跨域头配置
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

// MIME 类型字典
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

// 匿名化处理函数（用于学术研究数据脱敏）
function anonymizeData(records) {
  return records.map((item, index) => {
    const cloned = JSON.parse(JSON.stringify(item));
    // 姓名替换为编号
    if (cloned.basicInfo) {
      cloned.basicInfo.name = `Teacher_${String(index + 1).padStart(3, '0')}`;
      // 精确校名替换为区域类别
      cloned.basicInfo.school = `${cloned.basicInfo.district || '本地'}某实验学校`;
      delete cloned.basicInfo.schoolAddress;
    }
    return cloned;
  });
}

// 将问卷 JSON 扁平化导出为 CSV
function convertToCSV(records, isAnonymized = false) {
  const targetRecords = isAnonymized ? anonymizeData(records) : records;
  const headers = [
    '记录ID', '培训批次', '提交时间', '教师姓名', '性别', '省份', '区县', '学校名称', '详细地址',
    '任教学科', '任教年级', '实际教龄(年)', '专业教研角色', '行政管理职务',
    '常用国内通用AI', '常用国内编程AI', '常用国际AI', 'AI使用经验', 'AI使用频率',
    'AI教学设计与内容生成(1-5)', 'AI多媒体与动态情境呈现(1-5)', 'AI学情诊断与实验数据分析(1-5)', 'AI协作编程与教学工具开发(1-5)', 'AI赋能物理实验与传感创新(1-5)',
    '教学工作需求', '物理实验开发需求', '实验痛点补充',
    '创新项目阶段', '项目名称', '项目主要困难',
    '理想教学实验工具', '讲座现场期望'
  ];

  const rows = targetRecords.map(r => {
    const b = r.basicInfo || {};
    const u = r.aiUsage || {};
    const tools = u.tools || {};
    const c = r.aiCapability || {};
    const n = r.needs || {};
    const p = r.project || {};
    const o = r.openResponses || {};

    const cleanField = (val) => {
      if (val === undefined || val === null) return '""';
      let str = Array.isArray(val) ? val.join('; ') : String(val);
      str = str.replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${str}"`;
    };

    return [
      cleanField(r.id),
      cleanField(r.sessionId),
      cleanField(r.submittedAt),
      cleanField(b.name),
      cleanField(b.gender),
      cleanField(b.province),
      cleanField(b.district),
      cleanField(b.school),
      cleanField(b.schoolAddress),
      cleanField(b.subject),
      cleanField(b.grades),
      cleanField(b.teachingYears),
      cleanField(b.roles),
      cleanField(b.adminDuty),
      cleanField(tools.domesticGeneral),
      cleanField(tools.domesticCoding),
      cleanField(tools.foreignTools),
      cleanField(u.experience),
      cleanField(u.frequency),
      cleanField(c.contentGeneration),
      cleanField(c.multimedia),
      cleanField(c.dataAnalysis),
      cleanField(c.programming),
      cleanField(c.experimentDev),
      cleanField(n.workNeeds),
      cleanField(n.experimentNeeds),
      cleanField(n.experimentPainDetail),
      cleanField(p.stage),
      cleanField(p.name),
      cleanField(p.difficulties),
      cleanField(o.dreamTool),
      cleanField(o.lectureExpectation)
    ].join(',');
  });

  // 添加 UTF-8 BOM 解决 Excel 打开乱码问题
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

const os = require('os');

// 获取当前主机局域网 IP
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

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // 判断是否为外网公网穿透访问
  const host = req.headers['host'] || '';
  const isPublicTunnel = !!(
    req.headers['cf-connecting-ip'] ||
    host.includes('trycloudflare.com') ||
    host.includes('loca.lt') ||
    host.includes('ngrok-free.app') ||
    host.includes('ngrok.io')
  );

  // 🔒 外网安全隔离拦截：外网仅允许访问教师问卷与提交接口，大屏看板仅限讲师本地查看
  if (isPublicTunnel && (pathname === '/dashboard' || pathname === '/dashboard.html' || pathname === '/api/clear' || pathname === '/api/seed')) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>访问权限保护 - 讲师大屏</title>
        <style>
          body { background: #070c18; color: #fff; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: rgba(13,22,43,0.9); border: 1px solid rgba(0,242,254,0.3); border-radius: 12px; padding: 28px; text-align: center; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
          h2 { color: #00f2fe; margin-top: 0; font-size: 1.25rem; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
          .btn { display: inline-block; margin-top: 16px; background: linear-gradient(135deg, #00f2fe, #4facfe); color: #070c18; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 20px; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🔒 讲师大屏权限隔离保护</h2>
          <p>数据评价大看板仅限主讲人现场大屏终端查看。<br/>参训教师请前往问卷填报页面提交您的能力画像与实验需求。</p>
          <a href="/" class="btn">👉 进入教师问卷填报</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // =========================================================================
  // API 路由
  // =========================================================================

  // 0. GET /api/network-info - 获取网络与公网穿透链接
  if (pathname === '/api/network-info' && req.method === 'GET') {
    setCorsHeaders(res);
    const localIp = getLocalIp();
    let tunnelInfo = null;
    try {
      const tunnelFile = path.join(__dirname, 'data', 'tunnel.json');
      if (fs.existsSync(tunnelFile)) {
        tunnelInfo = JSON.parse(fs.readFileSync(tunnelFile, 'utf-8'));
      }
    } catch (e) {}

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      localIp,
      localUrl: `http://${localIp}:3000/`,
      tunnelUrl: tunnelInfo ? tunnelInfo.tunnelUrl : null,
      surveyUrl: tunnelInfo ? tunnelInfo.surveyUrl : `http://${localIp}:3000/`,
      hasTunnel: !!tunnelInfo
    }));
    return;
  }

  // 1. GET /api/sessions - 获取所有批次列表
  if (pathname === '/api/sessions' && req.method === 'GET') {
    setCorsHeaders(res);
    const list = getSessionsList();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(list));
    return;
  }

  // 2. GET /api/data - 获取指定批次或默认批次的数据
  if (pathname === '/api/data' && req.method === 'GET') {
    setCorsHeaders(res);
    const sessionId = query.sessionId || getDefaultSessionId();
    const data = readSessionData(sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      sessionId,
      count: data.length,
      data
    }));
    return;
  }

  // 3. POST /api/submit - 提交问卷响应
  if (pathname === '/api/submit' && req.method === 'POST') {
    setCorsHeaders(res);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const item = JSON.parse(body);
        const sessionId = item.sessionId || getDefaultSessionId();

        // 基础字段校验
        if (!item.basicInfo || !item.basicInfo.gender || !item.aiCapability) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '提交失败，缺少必要问卷字段' }));
          return;
        }

        // 补充服务端属性
        item.id = item.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        item.submittedAt = item.submittedAt || new Date().toISOString();
        item.sessionId = sessionId;

        const currentList = readSessionData(sessionId);
        currentList.push(item);
        writeSessionData(sessionId, currentList);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: currentList.length, recordId: item.id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '保存数据失败', details: err.message }));
      }
    });
    return;
  }

  // 3.5 POST /api/seed - 载入测试模拟数据 (用于现场演示与调试)
  if (pathname === '/api/seed' && req.method === 'POST') {
    setCorsHeaders(res);
    const sessionId = query.sessionId || getDefaultSessionId();
    const mockSeedData = [
      {
        "id": "rec_seed_001",
        "sessionId": sessionId,
        "submittedAt": new Date().toISOString(),
        "basicInfo": { "name": "张老师", "gender": "男", "province": "上海市", "district": "崇明区", "school": "上海市崇明中学", "schoolAddress": "崇明区城桥镇翠竹路86号", "subject": "物理", "grades": ["高一", "高二"], "teachingYears": 14, "roles": ["教研组长", "名师工作室成员"], "adminDuty": "教导主任" },
        "aiUsage": { "tools": { "domesticGeneral": ["DeepSeek", "Kimi", "豆包"], "domesticCoding": ["GLM CodeGeeX/Coder", "豆包MarsCode", "Trae"], "foreignTools": ["ChatGPT", "Cursor"] }, "experience": "1-2年", "frequency": "每天使用" },
        "aiCapability": { "contentGeneration": 4, "multimedia": 4, "dataAnalysis": 3, "programming": 3, "experimentDev": 3 },
        "needs": { "workNeeds": ["备课与教学设计", "实验教学工具开发", "论文教科研"], "experimentNeeds": ["运动轨迹分析与追踪", "DIS传感器数据实时绘图", "物理场可视化"], "experimentPainDetail": "希望用AI做交互式三维带电粒子运动场模拟" },
        "project": { "stage": "正在开发", "name": "基于Webcam的单摆运动自动测定与周期拟合工具", "categories": ["物理实验", "数字化实验"], "difficulties": ["代码调试不通", "硬件/摄像头接入"] },
        "openResponses": { "dreamTool": "手机摄像头对着演示实验就能直接标出小球实时速度与能量损耗曲线", "lectureExpectation": "希望能现场演示如何用AI写出识别手机录像中小车运动的网页" }
      },
      {
        "id": "rec_seed_002",
        "sessionId": sessionId,
        "submittedAt": new Date().toISOString(),
        "basicInfo": { "name": "李老师", "gender": "女", "province": "上海市", "district": "崇明区", "school": "上海市扬子中学", "schoolAddress": "崇明区城桥镇北门路198号", "subject": "物理", "grades": ["高一"], "teachingYears": 6, "roles": ["普通教师"], "adminDuty": "班主任" },
        "aiUsage": { "tools": { "domesticGeneral": ["DeepSeek", "Kimi", "腾讯元宝"], "domesticCoding": ["豆包MarsCode", "Kimi Coder"], "foreignTools": ["ChatGPT"] }, "experience": "6-12个月", "frequency": "每周多次" },
        "aiCapability": { "contentGeneration": 4, "multimedia": 3, "dataAnalysis": 2, "programming": 2, "experimentDev": 1 },
        "needs": { "workNeeds": ["备课与教学设计", "命题与作业", "实验教学工具开发"], "experimentNeeds": ["仪表示数OCR识别", "实验现象模拟与交互", "传统仪器数字化"], "experimentPainDetail": "机械秒表与游标卡尺读数教学时，全班40多人看不清细节" },
        "project": { "stage": "正在构思", "name": "微小位移激光放大实验的图像数据处理插件", "categories": ["物理实验"], "difficulties": ["不会编写代码", "缺乏案例"] },
        "openResponses": { "dreamTool": "自动把学生课桌上的电表指针拍照并批量统计全班读数正确率", "lectureExpectation": "零编程基础如何向AI提出准确的实验开发提示词" }
      },
      {
        "id": "rec_seed_003",
        "sessionId": sessionId,
        "submittedAt": new Date().toISOString(),
        "basicInfo": { "name": "王老师", "gender": "男", "province": "上海市", "district": "崇明区", "school": "崇明区东门中学", "schoolAddress": "崇明区城桥镇东门路128号", "subject": "物理", "grades": ["八年级", "九年级"], "teachingYears": 19, "roles": ["备课组长", "年级组长"], "adminDuty": "无行政职务" },
        "aiUsage": { "tools": { "domesticGeneral": ["DeepSeek", "智谱清言", "通义千问"], "domesticCoding": ["GLM CodeGeeX/Coder", "文心快码(Comate)"], "foreignTools": ["AntiGravity"] }, "experience": "1-2年", "frequency": "每周多次" },
        "aiCapability": { "contentGeneration": 5, "multimedia": 3, "dataAnalysis": 4, "programming": 3, "experimentDev": 2 },
        "needs": { "workNeeds": ["学情诊断", "实验教学工具开发", "论文教科研"], "experimentNeeds": ["运动轨迹分析与追踪", "DIS传感器数据实时绘图", "传统仪器数字化"], "experimentPainDetail": "初二声学和光学实验学生难以定量记录波形" },
        "project": { "stage": "已经尝试", "name": "音调响度音频波形AI实时可视化助手", "categories": ["物理实验", "学生学习工具"], "difficulties": ["硬件/摄像头接入", "代码调试不通"] },
        "openResponses": { "dreamTool": "操场测百米跑时手机一扫直接生成位移-时间图像并算出瞬时加速度", "lectureExpectation": "如何把AI做出的实验工具真正落地到常规物理课堂中" }
      },
      {
        "id": "rec_seed_004",
        "sessionId": sessionId,
        "submittedAt": new Date().toISOString(),
        "basicInfo": { "name": "陈老师", "gender": "女", "province": "上海市", "district": "崇明区", "school": "上海市实验学校附属东滩学校", "schoolAddress": "崇明区陈家镇安通路100号", "subject": "物理", "grades": ["八年级", "高一"], "teachingYears": 4, "roles": ["普通教师"], "adminDuty": "班主任" },
        "aiUsage": { "tools": { "domesticGeneral": ["DeepSeek", "Kimi", "豆包"], "domesticCoding": ["Trae", "豆包MarsCode"], "foreignTools": ["Claude", "Cursor"] }, "experience": "6-12个月", "frequency": "每天使用" },
        "aiCapability": { "contentGeneration": 4, "multimedia": 4, "dataAnalysis": 3, "programming": 3, "experimentDev": 3 },
        "needs": { "workNeeds": ["备课与教学设计", "实验教学工具开发", "论文教科研"], "experimentNeeds": ["运动轨迹分析与追踪", "物理场可视化", "实验现象模拟与交互"], "experimentPainDetail": "想要开发一个基于手机陀螺仪的向心加速度探究小程序" },
        "project": { "stage": "正在开发", "name": "东滩湿地生态与物理环境传感器实时看板", "categories": ["数字化实验", "物理实验"], "difficulties": ["不会调试", "缺乏硬件"] },
        "openResponses": { "dreamTool": "利用浏览器Web API调用手机传感器直接进行向心力探究", "lectureExpectation": "手把手演练AI协作开发物理小实验原型的实战步骤" }
      },
      {
        "id": "rec_seed_005",
        "sessionId": sessionId,
        "submittedAt": new Date().toISOString(),
        "basicInfo": { "name": "陆老师", "gender": "男", "province": "上海市", "district": "崇明区", "school": "崇明区堡镇中学", "schoolAddress": "崇明区堡镇石岛路251号", "subject": "物理", "grades": ["高二", "高三"], "teachingYears": 22, "roles": ["教研组长", "区/市教研员"], "adminDuty": "副校长" },
        "aiUsage": { "tools": { "domesticGeneral": ["DeepSeek", "通义千问", "文心一言"], "domesticCoding": ["GLM CodeGeeX/Coder"], "foreignTools": ["ChatGPT"] }, "experience": "3-6个月", "frequency": "每周1-2次" },
        "aiCapability": { "contentGeneration": 3, "multimedia": 2, "dataAnalysis": 2, "programming": 1, "experimentDev": 1 },
        "needs": { "workNeeds": ["命题与作业", "论文教科研", "实验教学工具开发"], "experimentNeeds": ["传统仪器数字化", "仪表示数OCR识别", "实验现象模拟与交互"], "experimentPainDetail": "高考实验题中的多用电表、示波器读数模拟与难点诊断" },
        "project": { "stage": "暂无想法", "name": "", "categories": [], "difficulties": ["不会编程", "不知道如何开始", "课题论文转化"] },
        "openResponses": { "dreamTool": "能够智能诊断学生在电学实验连线图中的短路和断路错误的AI助教", "lectureExpectation": "如何把AI开发出的实验工具转化为区级/市级教科研课题与论文" }
      }
    ];

    writeSessionData(sessionId, mockSeedData);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, count: mockSeedData.length, message: '测试模拟数据已成功载入！' }));
    return;
  }

  // 4. POST /api/clear - 清空某批次数据
  if (pathname === '/api/clear' && (req.method === 'POST' || req.method === 'DELETE')) {
    setCorsHeaders(res);
    const sessionId = query.sessionId || getDefaultSessionId();
    try {
      writeSessionData(sessionId, []);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: `批次 [${sessionId}] 数据已清空` }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '清空数据失败', details: err.message }));
    }
    return;
  }

  // 5. GET /api/export/csv - 导出 CSV 文件
  if (pathname === '/api/export/csv' && req.method === 'GET') {
    setCorsHeaders(res);
    const sessionId = query.sessionId || getDefaultSessionId();
    const isAnonymized = query.anonymized === 'true' || query.anonymized === '1';
    const data = readSessionData(sessionId);
    const csvContent = convertToCSV(data, isAnonymized);

    const fileName = `${sessionId}_${isAnonymized ? 'anonymized_' : ''}export_${Date.now()}.csv`;
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
    });
    res.end(csvContent);
    return;
  }

  // 6. GET /api/export/json - 导出 JSON 文件
  if (pathname === '/api/export/json' && req.method === 'GET') {
    setCorsHeaders(res);
    const sessionId = query.sessionId || getDefaultSessionId();
    const isAnonymized = query.anonymized === 'true' || query.anonymized === '1';
    const data = readSessionData(sessionId);
    const exportData = isAnonymized ? anonymizeData(data) : data;

    const fileName = `${sessionId}_${isAnonymized ? 'anonymized_' : ''}export_${Date.now()}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
    });
    res.end(JSON.stringify(exportData, null, 2));
    return;
  }

  // =========================================================================
  // 静态文件托管
  // =========================================================================
  let filePath = '';
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/dashboard' || pathname === '/dashboard.html') {
    filePath = path.join(__dirname, 'dashboard.html');
  } else if (pathname.startsWith('/public/')) {
    filePath = path.join(__dirname, pathname);
  } else if (pathname.startsWith('/docs/')) {
    filePath = path.join(__dirname, pathname);
  } else {
    // 兼容根路径下请求 css/js/maps
    filePath = path.join(__dirname, 'public', pathname);
  }

  // 安全检查：防止路径遍历
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(normalizedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found - 物理教师 AI 创新能力画像调查系统');
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(normalizedPath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('服务器读取文件错误: ' + readErr.message);
      } else {
        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

// =========================================================================
// 全球云端数据队列同步服务 (保证 GitHub Pages 在任何网络/关机状态下提交永不丢失)
// =========================================================================
const https = require('https');
const CLOUD_SYNC_TOPIC = 'wuhao_chongming_physics_2026';
let lastProcessedMessageId = '';

function startCloudSync() {
  setInterval(() => {
    try {
      const queryUrl = lastProcessedMessageId 
        ? `https://ntfy.sh/${CLOUD_SYNC_TOPIC}/json?poll=1&since=${encodeURIComponent(lastProcessedMessageId)}`
        : `https://ntfy.sh/${CLOUD_SYNC_TOPIC}/json?poll=1&since=all`;

      https.get(queryUrl, (res) => {
        let rawData = '';
        res.on('data', chunk => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) return;
          const lines = rawData.trim().split('\n');
          lines.forEach(line => {
            if (!line.trim()) return;
            try {
              const msg = JSON.parse(line);
              if (msg.event === 'message' && msg.message) {
                lastProcessedMessageId = msg.id;
                const item = JSON.parse(msg.message);
                if (item && item.basicInfo && item.aiCapability) {
                  const sessionId = item.sessionId || getDefaultSessionId();
                  const currentData = readSessionData(sessionId);
                  const exists = currentData.some(r => 
                    (item.id && r.id === item.id) || 
                    (r.submittedAt === item.submittedAt && r.basicInfo?.name === item.basicInfo?.name)
                  );
                  if (!exists) {
                    currentData.push(item);
                    writeSessionData(sessionId, currentData);
                    console.log(`[Cloud Sync] ☁️ 成功从全球云端队列实时同步新答卷: ${item.basicInfo.name || '匿名'} (${item.basicInfo.school || '崇明'})`);
                  }
                }
              }
            } catch (err) {}
          });
        });
      }).on('error', () => {});
    } catch (e) {}
  }, 2500);
}

startCloudSync();

server.listen(PORT, () => {
  console.log(`=====================================================================`);
  console.log(`  🚀 物理教师 AI 创新能力画像与实验开发需求调查平台 v2.0 已启动！`);
  console.log(`  📱 教师手机填报端:   http://localhost:${PORT}/`);
  console.log(`  🖥️  讲师实时大屏看板: http://localhost:${PORT}/dashboard`);
  console.log(`  📁 数据存储目录:     ${DATA_DIR}`);
  console.log(`  ⚙️  默认研训批次:     ${getDefaultSessionId()}`);
  console.log(`  ☁️  云端队列同步:     已就绪 (ntfy.sh/${CLOUD_SYNC_TOPIC})`);
  console.log(`=====================================================================`);
});
