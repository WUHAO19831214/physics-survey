/**
 * AI 文本挖掘与现场讲座建议引擎 (AI Analysis & Lecture Advisor)
 * 特性：双引擎架构（本地 Ollama 大模型 + 本地离线规则分词聚类兜底）
 */

const AiAnalyser = {
  ollamaUrl: 'http://localhost:11434/api/generate',
  ollamaModel: 'gemma:4b',
  isOllamaAvailable: false,

  /**
   * 检测本地 Ollama 服务是否在线
   */
  async checkOllama() {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch('http://localhost:11434/api/tags', { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map(m => m.name);
        this.isOllamaAvailable = true;
        return { online: true, models };
      }
    } catch (e) {
      this.isOllamaAvailable = false;
    }
    return { online: false, models: [] };
  },

  /**
   * 核心聚类词典（物理教育与 AI 开发领域专用）
   */
  clusterKeywords: [
    { cat: '实验数据采集与拟合', keys: ['数据采集', '实时绘图', '拟合', '曲线', 'DIS', '传感器', '单摆', '加速度', '速度', '测量', '误差'] },
    { cat: '视觉识别与轨迹追踪', keys: ['摄像头', '视觉', '识别', '追踪', '轨迹', '录像', '小车', '运动', '自由落体', '视频'] },
    { cat: '仪表数字化与OCR', keys: ['OCR', '仪表', '读数', '多用电表', '游标卡尺', '指针', '秒表', '刻度', '数字化'] },
    { cat: '物理场可视化与仿真', keys: ['物理场', '三维', '仿真', '模拟', '磁场', '电场', '受力分析', '带电粒子'] },
    { cat: 'AI协作编程与原型调试', keys: ['编程', '代码', '调试', 'Prompt', '提示词', '网页', 'HTML', '部署', '开发'] },
    { cat: '教科研与论文课题转化', keys: ['论文', '课题', '区级', '市级', '成果', '教学设计', '教研'] }
  ],

  /**
   * 本地规则关键词提取与频次统计
   */
  extractKeywordsFromRecords(records) {
    const textCorpus = [];
    records.forEach(r => {
      const o = r.openResponses || {};
      const n = r.needs || {};
      const p = r.project || {};
      if (o.dreamTool) textCorpus.push(o.dreamTool);
      if (o.teachingPainPoint) textCorpus.push(o.teachingPainPoint);
      if (o.lectureExpectation) textCorpus.push(o.lectureExpectation);
      if (n.experimentPainDetail) textCorpus.push(n.experimentPainDetail);
      if (p.name) textCorpus.push(p.name);
    });

    const fullText = textCorpus.join(' ');
    const counts = {};

    this.clusterKeywords.forEach(group => {
      group.keys.forEach(k => {
        const reg = new RegExp(k, 'gi');
        const matches = fullText.match(reg);
        if (matches && matches.length > 0) {
          counts[k] = (counts[k] || 0) + matches.length;
        }
      });
    });

    // 排序 TOP 12 关键词
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, freq]) => ({ word, freq }));

    return sorted;
  },

  /**
   * 本地规则引擎生成讲座调整建议
   */
  generateRuleBasedAdvice(records, capabilitySummary) {
    const N = records.length;
    if (N === 0) {
      return {
        summary: "当前尚无教师提交问卷数据，请提示参训教师扫码填报。",
        focusStrengthen: ["物理教学中的生成式 AI 基础应用", "零代码提示词工程入门"],
        focusReduce: ["复杂理论推导"],
        keywords: []
      };
    }

    const keywords = this.extractKeywordsFromRecords(records);
    const avgScores = capabilitySummary.scores || [0, 0, 0, 0, 0];
    const progScore = avgScores[3]; // 编程开发均分
    const expScore = avgScores[4];  // 实验开发均分

    const strengthen = [];
    const reduce = [];

    // 根据能力短板与期望推导现场侧重
    if (progScore < 45) {
      strengthen.push("【零代码门槛】重点演示如何用清晰的自然语言 Prompt 指挥 AI 生成完整物理实验交互网页");
      reduce.push("高难度手写代码与底层算法语法讲解");
    } else {
      strengthen.push("【进阶调试】重点讲解 AI 生成代码的快速排错、Web API 摄像头接入与参数调优");
    }

    if (expScore < 45) {
      strengthen.push("【实验赋能】现场手把手复现‘手机摄像头视频运动轨迹自动提取’典型案例");
    } else {
      strengthen.push("【多模态融合】拓展传感器数据蓝牙/串口实时接入与三维物理场可视化建模");
    }

    // 根据高频词追加
    const topWords = keywords.slice(0, 3).map(k => k.word).join('、');
    if (topWords) {
      strengthen.push(`【现场聚焦】结合参训教师集中关注的“${topWords}”开展实战演示与代码开源`);
    }

    strengthen.push("【成果转化】指导教师如何将现场开发的 AI 实验工具提炼为教科研论文与区级创新成果");

    return {
      summary: `已分析本场 ${N} 位参训教师画像：教师队伍在教学内容生成方面具备良好基础，但在物理实验与代码落地层面存在较强诉求与技术卡点。`,
      focusStrengthen: strengthen,
      focusReduce: reduce,
      keywords: keywords
    };
  },

  /**
   * 综合分析入口：优先调用 Ollama，失败时无缝切换为本地规则分析
   */
  async runAnalysis(records, capabilitySummary) {
    const fallbackResult = this.generateRuleBasedAdvice(records, capabilitySummary);

    // 如果 Ollama 在线且有数据，尝试获取深度洞察
    if (this.isOllamaAvailable && records.length > 0) {
      try {
        const prompt = `你是一位物理教育专家与AI技术培训导师。以下是本次讲座${records.length}位中学物理教师的调研简报：
- 教师AI内容生成能力平均分: ${capabilitySummary.scores[0]}分/100
- 教师编程协作开发能力平均分: ${capabilitySummary.scores[3]}分/100
- 教师物理实验创新开发能力平均分: ${capabilitySummary.scores[4]}分/100
- 教师热点关注词: ${fallbackResult.keywords.map(k => k.word).join(', ')}
请用严谨精炼的语言输出两部分建议（限200字以内）：
1. 【本场讲座重点增加】
2. 【本场讲座适当精简】`;

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(this.ollamaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.ollamaModel,
            prompt: prompt,
            stream: false
          }),
          signal: ctrl.signal
        });
        clearTimeout(tid);

        if (res.ok) {
          const data = await res.json();
          return {
            source: 'Ollama (' + this.ollamaModel + ')',
            content: data.response,
            keywords: fallbackResult.keywords,
            isOllama: true
          };
        }
      } catch (e) {
        console.warn('Ollama 推理超时或断开，已平滑切换为本地离线规则引擎。', e);
      }
    }

    // 规则引擎输出格式化 HTML 内容
    let html = `<p style="margin-bottom: 8px;"><strong>📊 群体画像洞察：</strong>${fallbackResult.summary}</p>`;
    html += `<p style="color: var(--accent-cyan); font-weight: 600; margin-top: 8px;">🎯 建议本场讲座重点加强：</p><ul style="padding-left: 18px; margin-bottom: 8px;">`;
    fallbackResult.focusStrengthen.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += `</ul>`;

    if (fallbackResult.focusReduce.length > 0) {
      html += `<p style="color: var(--accent-orange); font-weight: 600; margin-top: 6px;">⚡ 建议本场讲座适度降低：</p><ul style="padding-left: 18px;">`;
      fallbackResult.focusReduce.forEach(item => {
        html += `<li>${item}</li>`;
      });
      html += `</ul>`;
    }

    return {
      source: '本地规则分析引擎 (离线稳定)',
      content: html,
      keywords: fallbackResult.keywords,
      isOllama: false
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AiAnalyser;
}
