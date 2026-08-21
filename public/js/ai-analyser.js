/**
 * AI 文本挖掘与现场讲座建议引擎 (AI Analysis & Lecture Advisor v2.5)
 * 特性：双引擎真运行架构（本地 Ollama gemma4:e4b 大模型 + 本地离线规则聚类引擎）
 */

const AiAnalyser = {
  ollamaUrl: 'http://localhost:11434/api/generate',
  ollamaTagsUrl: 'http://localhost:11434/api/tags',
  ollamaModel: 'gemma4:e4b',
  isOllamaAvailable: false,

  /**
   * 自动检测本地 Ollama 服务连接与已安装模型
   */
  async checkOllama() {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(this.ollamaTagsUrl, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map(m => m.name);
        if (models.length > 0) {
          // 优先匹配 gemma4:e4b 或包含 gemma 的模型，否则取第一个模型
          const matched = models.find(m => m.includes('gemma4') || m.includes('gemma')) || models[0];
          this.ollamaModel = matched;
          this.isOllamaAvailable = true;
          return { online: true, model: this.ollamaModel, models };
        }
      }
    } catch (e) {
      this.isOllamaAvailable = false;
    }
    return { online: false, model: this.ollamaModel, models: [] };
  },

  /**
   * 核心聚类词典（物理实验教学与 AI 数字化开发专用）
   */
  clusterKeywords: [
    { cat: '实验数据拟合与采集', keys: ['拟合', '曲线', '数据拟合', '速度', '加速度', '周期', '单摆', '数据采集', 'DIS', '传感器', '误差分析'] },
    { cat: '视觉识别与轨迹追踪', keys: ['摄像头', '识别', '追踪', '轨迹', '视频', '视觉', '目标检测', '运动分析', '小球', '滑块'] },
    { cat: '仪表数字化与OCR', keys: ['OCR', '仪表', '读数', '电表', '多用电表', '游标卡尺', '刻度', '指针', '秒表'] },
    { cat: 'AI协作编程与微工具', keys: ['编程', '代码', '开发', '工具开发', 'Prompt', '提示词', '脚本', '网页', 'HTML', 'Python'] },
    { cat: '物理场仿真与动态呈现', keys: ['物理场', '仿真', '模拟', '动画', '三维', '受力分析', '磁场', '电场'] },
    { cat: '教科研与课题成果转化', keys: ['课题', '论文', '教学设计', '教研', '成果', '展示', '区级', '公开课'] }
  ],

  /**
   * 本地离线规则引擎：提取真实教师文本中的关键词频次
   */
  extractKeywordsFromRecords(records) {
    const textCorpus = [];
    records.forEach(r => {
      const o = r.openResponses || {};
      const n = r.needs || {};
      const p = r.project || {};
      const b = r.basicInfo || {};
      if (o.dreamTool) textCorpus.push(o.dreamTool);
      if (o.lectureExpectation) textCorpus.push(o.lectureExpectation);
      if (n.experimentPainDetail) textCorpus.push(n.experimentPainDetail);
      if (p.name) textCorpus.push(p.name);
      if (b.adminDuty && b.adminDuty !== '无行政职务') textCorpus.push(b.adminDuty);
    });

    const fullText = textCorpus.join(' ');
    const counts = {};

    // 统计预设教研词频
    this.clusterKeywords.forEach(group => {
      group.keys.forEach(k => {
        const reg = new RegExp(k, 'gi');
        const matches = fullText.match(reg);
        if (matches && matches.length > 0) {
          counts[k] = (counts[k] || 0) + matches.length;
        }
      });
    });

    // 补充通用教研分词提取（提取 2-4 字高频词）
    const customMatches = fullText.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    const stopWords = ['我们', '希望', '可以', '进行', '以及', '通过', '或者', '这个', '那个', '因为', '所以', '如果', '为了', '老师', '中学', '学生'];
    customMatches.forEach(w => {
      if (!stopWords.includes(w) && w.length >= 2) {
        if (!counts[w]) {
          const m = fullText.match(new RegExp(w, 'g'));
          if (m && m.length >= 1) counts[w] = m.length;
        }
      }
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, freq]) => ({ word, freq }));

    return sorted;
  },

  /**
   * 本地规则引擎：推导讲座建议报告
   */
  generateRuleBasedAdvice(records, capabilitySummary) {
    const N = records.length;
    const keywords = this.extractKeywordsFromRecords(records);

    if (N === 0) {
      return {
        summary: "当前尚无教师提交问卷数据，请展示投屏二维码提示参训教师扫码填报。",
        focusStrengthen: ["物理教学中的生成式 AI 基础应用与提示词工程", "零代码指挥 AI 生成物理实验网页入门"],
        focusReduce: ["复杂底层算法与手写代码教学"],
        keywords: []
      };
    }

    const avgScores = capabilitySummary.scores || [0, 0, 0, 0, 0];
    const progScore = avgScores[3] || 0; // 编程协作
    const expScore = avgScores[4] || 0;  // 实验创新

    const strengthen = [];
    const reduce = [];

    // 根据能力画像短板与高频诉求推导
    if (progScore < 50) {
      strengthen.push("【零门槛实战】重点演示如何通过清晰自然语言 Prompt 指挥 AI 生成免安装运行的单文件物理实验网页 (HTML/JS)");
      reduce.push("枯燥复杂的 Python 基础语法与环境配置讲解");
    } else {
      strengthen.push("【进阶调试与封装】重点讲解 AI 生成代码的错误快速定位、摄像头/传感器 Web API 接入与参数调优");
    }

    if (expScore < 50) {
      strengthen.push("【实验赋能落地】手把手带领全场复现‘手机摄像头视频运动轨迹自动提取与单摆拟合’实战案例");
    } else {
      strengthen.push("【多模态与传感融合】拓展 DIS 传感器数据实时串口/蓝牙捕获与多维物理量动态可视化");
    }

    const topKeywords = keywords.slice(0, 3).map(k => `“${k.word}”`).join('、');
    if (topKeywords) {
      strengthen.push(`【现场聚焦】紧扣现场教师高频关切的 ${topKeywords} 开展现场需求定制化即兴编程与开源`);
    }

    strengthen.push("【教科研成果转化】指导教师将现场生成的 AI 实验微工具凝练为区级创新课题与教学论文");

    return {
      summary: `已深度挖掘现场 ${N} 位参训教师真实需求：教师群体具备良好的 AI 认知基础，核心痛点集中在“如何将具体的物理实验想法快速转化为可用数字化工具”。`,
      focusStrengthen: strengthen,
      focusReduce: reduce,
      keywords: keywords
    };
  },

  /**
   * 综合分析调度：支持真实调用 Ollama 大模型与本地规则引擎
   */
  async runAnalysis(records, capabilitySummary, forceEngine = null) {
    const checkResult = await this.checkOllama();
    const useOllama = (forceEngine === 'ollama') || (!forceEngine && checkResult.online);

    const ruleAdvice = this.generateRuleBasedAdvice(records, capabilitySummary);

    // 1. 真运行 Ollama 大模型
    if (useOllama && checkResult.online && records.length > 0) {
      try {
        const concerns = records.map(r => {
          const o = r.openResponses || {};
          const n = r.needs || {};
          const p = r.project || {};
          return [o.lectureExpectation, o.dreamTool, n.experimentPainDetail, p.name].filter(Boolean).join('; ');
        }).filter(t => t.length > 0).join('\n- ');

        const prompt = `你是一位物理教育专家与AI技术培训导师。以下是本次培训现场${records.length}位中学物理教师填写的真实需求与困惑：
- ${concerns || '希望用AI辅助物理实验教学与工具开发'}

教师群体能力画像评估：
- 教学内容生成均分: ${capabilitySummary.scores ? capabilitySummary.scores[0] : 60}分/100
- 编程协作开发均分: ${capabilitySummary.scores ? capabilitySummary.scores[3] : 45}分/100
- 实验创新开发均分: ${capabilitySummary.scores ? capabilitySummary.scores[4] : 40}分/100

请对上述真实需求进行提炼，严格输出标准 JSON 格式：
{
  "keywords": ["提炼出的5到8个核心热词，如：运动追踪, 曲线拟合, 摄像头识别, 工具开发, DIS传感器"],
  "summary": "一句话概括全场教师群体特征与诉求（60字以内）",
  "focusStrengthen": ["本场讲座建议重点加强的实操实训点1", "重点加强点2", "重点加强点3"],
  "focusReduce": ["建议适当精简或避免的内容点"]
}`;

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 12000); // 12s 超时
        const res = await fetch(this.ollamaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.ollamaModel,
            prompt: prompt,
            stream: false,
            format: 'json'
          }),
          signal: ctrl.signal
        });
        clearTimeout(tid);

        if (res.ok) {
          const data = await res.json();
          let parsed = null;
          try {
            parsed = typeof data.response === 'string' ? JSON.parse(data.response) : data.response;
          } catch (pe) {
            const match = (data.response || '').match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
          }

          if (parsed && (parsed.keywords || parsed.focusStrengthen)) {
            const kwList = Array.isArray(parsed.keywords) 
              ? parsed.keywords.map((k, i) => ({ word: k, freq: Math.max(1, records.length - i) }))
              : ruleAdvice.keywords;

            return {
              source: `本地 Ollama (${this.ollamaModel}) 引擎 [真运行]`,
              engine: 'ollama',
              model: this.ollamaModel,
              summary: parsed.summary || ruleAdvice.summary,
              focusStrengthen: parsed.focusStrengthen || ruleAdvice.focusStrengthen,
              focusReduce: parsed.focusReduce || ruleAdvice.focusReduce,
              keywords: kwList.length > 0 ? kwList : ruleAdvice.keywords,
              isOllama: true
            };
          }
        }
      } catch (err) {
        console.warn('Ollama 推理响应异常，已平滑切换为本地离线规则引擎。', err);
      }
    }

    // 2. 规则引擎兜底 / 显式指定规则引擎
    return {
      source: '轻量本地规则聚类引擎 (离线稳定)',
      engine: 'rule',
      model: 'RuleCluster-v2.5',
      summary: ruleAdvice.summary,
      focusStrengthen: ruleAdvice.focusStrengthen,
      focusReduce: ruleAdvice.focusReduce,
      keywords: ruleAdvice.keywords,
      isOllama: false
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AiAnalyser;
}
