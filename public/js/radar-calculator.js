/**
 * 物理教师 AI 创新能力画像计算器 (Radar & Capability Metrics Calculator)
 * 遵循 docs/scoring-method.md 规范
 */

const RadarCalculator = {
  // 5个核心维度定义与展示标签
  dimensions: [
    { key: 'contentGeneration', label: '教学内容生成', maxScore: 5 },
    { key: 'multimedia', label: '多媒体交互课件', maxScore: 5 },
    { key: 'dataAnalysis', label: '学情与数据分析', maxScore: 5 },
    { key: 'programming', label: '编程与协作开发', maxScore: 5 },
    { key: 'experimentDev', label: '物理实验创新开发', maxScore: 5 }
  ],

  /**
   * 将单条记录的 1-5 分制转换为 0-100 指数
   */
  calculateRecordScores(capabilityObj) {
    if (!capabilityObj) {
      return {
        contentGeneration: 0,
        multimedia: 0,
        dataAnalysis: 0,
        programming: 0,
        experimentDev: 0,
        overallIndex: 0
      };
    }

    const toIndex = (score) => {
      const s = Number(score) || 1;
      return Math.round(Math.max(0, Math.min(100, (s - 1) * 25)));
    };

    const result = {
      contentGeneration: toIndex(capabilityObj.contentGeneration),
      multimedia: toIndex(capabilityObj.multimedia),
      dataAnalysis: toIndex(capabilityObj.dataAnalysis),
      programming: toIndex(capabilityObj.programming),
      experimentDev: toIndex(capabilityObj.experimentDev)
    };

    const sum = result.contentGeneration + result.multimedia + result.dataAnalysis + result.programming + result.experimentDev;
    result.overallIndex = Math.round(sum / 5);
    return result;
  },

  /**
   * 计算群体平均分与各维度均值
   */
  calculateCohortAverages(records) {
    if (!records || records.length === 0) {
      return {
        scores: [0, 0, 0, 0, 0],
        overallMean: 0,
        levelDistribution: { potential: 0, practice: 0, developer: 0, leader: 0 },
        count: 0
      };
    }

    let sums = [0, 0, 0, 0, 0];
    let totalOverall = 0;
    const levels = { potential: 0, practice: 0, developer: 0, leader: 0 };

    records.forEach(r => {
      const c = this.calculateRecordScores(r.aiCapability);
      sums[0] += c.contentGeneration;
      sums[1] += c.multimedia;
      sums[2] += c.dataAnalysis;
      sums[3] += c.programming;
      sums[4] += c.experimentDev;
      totalOverall += c.overallIndex;

      // 梯队划分
      if (c.overallIndex <= 30) levels.potential++;
      else if (c.overallIndex <= 60) levels.practice++;
      else if (c.overallIndex <= 85) levels.developer++;
      else levels.leader++;
    });

    const N = records.length;
    const avgScores = sums.map(s => Math.round(s / N));
    const overallMean = Math.round(totalOverall / N);

    return {
      scores: avgScores,
      overallMean,
      levelDistribution: levels,
      count: N
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RadarCalculator;
}
