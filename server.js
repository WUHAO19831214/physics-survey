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
    '记录ID', '培训批次', '提交时间', '教师姓名', '性别', '省份', '区县', '学校名称',
    '任教学科', '学段', '任教年级', '实际教龄(年)', '当前角色',
    '常用国内通用AI', '常用国内编程AI', '常用国际AI', 'AI使用经验', 'AI使用频率',
    '内容生成能力(1-5)', '多媒体制作能力(1-5)', '数据分析能力(1-5)', '编程开发能力(1-5)', '物理实验开发能力(1-5)',
    '教学工作需求', '物理实验开发需求', '实验痛点补充',
    '创新项目阶段', '项目名称', '项目方向', '项目主要困难',
    '理想教学实验工具', '教学最大痛点', '讲座期望'
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
      cleanField(b.subject),
      cleanField(b.schoolStages),
      cleanField(b.grades),
      cleanField(b.teachingYears),
      cleanField(b.roles),
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
      cleanField(p.categories),
      cleanField(p.difficulties),
      cleanField(o.dreamTool),
      cleanField(o.teachingPainPoint),
      cleanField(o.lectureExpectation)
    ].join(',');
  });

  // 添加 UTF-8 BOM 解决 Excel 打开乱码问题
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
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

  // =========================================================================
  // API 路由
  // =========================================================================

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

server.listen(PORT, () => {
  console.log(`=====================================================================`);
  console.log(`  🚀 物理教师 AI 创新能力画像与实验开发需求调查平台 v2.0 已启动！`);
  console.log(`  📱 教师手机填报端:   http://localhost:${PORT}/`);
  console.log(`  🖥️  讲师实时大屏看板: http://localhost:${PORT}/dashboard`);
  console.log(`  📁 数据存储目录:     ${DATA_DIR}`);
  console.log(`  ⚙️  默认研训批次:     ${getDefaultSessionId()}`);
  console.log(`=====================================================================`);
});
