/**
 * 讲师实时大屏看板控制器 (Dashboard Controller)
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentSessionId = '2026-chongming-ai-physics';
  let rawData = [];
  let pollTimer = null;

  // 初始化 ECharts 实例引用
  let mapChart = null;
  let radarChart = null;
  let yearsChart = null;
  let toolsChart = null;
  let expDemandChart = null;
  let projectFunnelChart = null;

  // 加载地图数据与初始化
  await initMapGeoJSON();
  initCharts();
  await loadSessions();
  await refreshData();

  // 启动 3 秒自动轮询实时数据
  pollTimer = setInterval(refreshData, 3500);

  // 窗口缩放适配
  window.addEventListener('resize', () => {
    [mapChart, radarChart, yearsChart, toolsChart, expDemandChart, projectFunnelChart].forEach(c => c && c.resize());
  });

  // 绑定事件
  document.getElementById('sessionSelect').addEventListener('change', (e) => {
    currentSessionId = e.target.value;
    refreshData();
  });

  document.getElementById('btnRefresh').addEventListener('click', refreshData);
  document.getElementById('btnExportCsv').addEventListener('click', () => exportData('csv', false));
  document.getElementById('btnExportAnonCsv').addEventListener('click', () => exportData('csv', true));
  document.getElementById('btnExportJson').addEventListener('click', () => exportData('json', false));
  document.getElementById('btnRunAi').addEventListener('click', runAiDeepAnalysis);

  // 表格搜索过滤
  document.getElementById('tableSearchInput').addEventListener('input', (e) => {
    renderTable(rawData, e.target.value.trim());
  });

  /**
   * 初始化地图 GeoJSON
   */
  async function initMapGeoJSON() {
    try {
      const res = await fetch('/public/maps/shanghai.json');
      if (res.ok) {
        const shanghaiJson = await res.json();
        echarts.registerMap('shanghai', shanghaiJson);
      }
    } catch (e) {
      console.warn('加载上海地图 GeoJSON 失败，使用备用模式', e);
    }
  }

  /**
   * 初始化所有 ECharts 图表
   */
  function initCharts() {
    mapChart = echarts.init(document.getElementById('mapChart'));
    radarChart = echarts.init(document.getElementById('radarChart'));
    yearsChart = echarts.init(document.getElementById('yearsChart'));
    toolsChart = echarts.init(document.getElementById('toolsChart'));
    expDemandChart = echarts.init(document.getElementById('expDemandChart'));
    projectFunnelChart = echarts.init(document.getElementById('projectFunnelChart'));
  }

  /**
   * 加载 Session 批次列表
   */
  async function loadSessions() {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const sessions = await res.json();
        const select = document.getElementById('sessionSelect');
        select.innerHTML = '';
        sessions.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.innerText = s.name;
          if (s.isDefault) opt.selected = true;
          select.appendChild(opt);
        });
        currentSessionId = select.value;
      }
    } catch (e) {}
  }

  /**
   * 刷新核心数据
   */
  async function refreshData() {
    try {
      const res = await fetch(`/api/data?sessionId=${encodeURIComponent(currentSessionId)}`);
      if (res.ok) {
        const json = await res.json();
        rawData = json.data || [];
        updateDashboard(rawData);
      }
    } catch (e) {
      console.warn('获取最新数据失败', e);
    }
  }

  /**
   * 驱动全看板更新
   */
  function updateDashboard(records) {
    // 1. 顶部 KPI
    updateKPIs(records);
    // 2. 地图更新
    renderMap(records);
    // 3. 5维能力雷达图
    const capabilitySummary = RadarCalculator.calculateCohortAverages(records);
    renderRadar(capabilitySummary);
    // 4. 教龄结构分布图
    renderYearsChart(records);
    // 5. AI 工具排行榜
    renderToolsChart(records);
    // 6. 物理实验创新需求排行
    renderExpDemandChart(records);
    // 7. 创新项目阶段漏斗
    renderProjectFunnel(records);
    // 8. 教师明细表
    renderTable(records, document.getElementById('tableSearchInput').value.trim());
    // 9. 智能讲座建议更新
    updateAiAdvice(records, capabilitySummary);
  }

  /**
   * 顶部 KPI 统计
   */
  function updateKPIs(records) {
    const N = records.length;
    document.getElementById('kpiCount').innerText = N;

    if (N === 0) {
      document.getElementById('kpiAvgYears').innerText = '0';
      document.getElementById('kpiAiRate').innerText = '0%';
      document.getElementById('kpiCodingRate').innerText = '0%';
      document.getElementById('kpiExpDemandRate').innerText = '0%';
      document.getElementById('kpiProjectRate').innerText = '0%';
      return;
    }

    // 平均教龄
    const totalYears = records.reduce((acc, r) => acc + (Number(r.basicInfo?.teachingYears) || 0), 0);
    document.getElementById('kpiAvgYears').innerText = (totalYears / N).toFixed(1);

    // AI 使用率 (经验非从未使用)
    const aiUsers = records.filter(r => r.aiUsage?.experience && r.aiUsage.experience !== '从未使用').length;
    document.getElementById('kpiAiRate').innerText = `${Math.round((aiUsers / N) * 100)}%`;

    // 尝试过 AI 编程比例
    const codingUsers = records.filter(r => {
      const codingTools = r.aiUsage?.tools?.domesticCoding || [];
      const c = r.aiCapability?.programming || 1;
      return codingTools.length > 0 || c >= 3;
    }).length;
    document.getElementById('kpiCodingRate').innerText = `${Math.round((codingUsers / N) * 100)}%`;

    // 实验工具开发需求比例
    const expNeeds = records.filter(r => {
      const w = r.needs?.workNeeds || [];
      const e = r.needs?.experimentNeeds || [];
      return w.includes('实验教学工具开发') || e.length > 0;
    }).length;
    document.getElementById('kpiExpDemandRate').innerText = `${Math.round((expNeeds / N) * 100)}%`;

    // 正在开展/构思项目比例
    const projTeachers = records.filter(r => r.project?.stage && r.project.stage !== '暂无想法').length;
    document.getElementById('kpiProjectRate').innerText = `${Math.round((projTeachers / N) * 100)}%`;
  }

  /**
   * 渲染地图
   */
  function renderMap(records) {
    const districtCount = {};
    records.forEach(r => {
      const dist = r.basicInfo?.district || '崇明区';
      districtCount[dist] = (districtCount[dist] || 0) + 1;
    });

    const mapData = Object.entries(districtCount).map(([name, value]) => ({ name, value }));

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} 位教师',
        backgroundColor: 'rgba(13, 22, 43, 0.9)',
        borderColor: '#00f2fe',
        textStyle: { color: '#ffffff' }
      },
      visualMap: {
        min: 0,
        max: Math.max(5, ...Object.values(districtCount)),
        left: 'right',
        bottom: '5%',
        text: ['高', '低'],
        textStyle: { color: '#8b9bb4' },
        inRange: { color: ['#0d1d3a', '#0072ff', '#00f2fe'] },
        calculable: true
      },
      series: [
        {
          name: '教师分布',
          type: 'map',
          map: 'shanghai',
          roam: true,
          label: {
            show: true,
            color: '#e2e8f0',
            fontSize: 10
          },
          itemStyle: {
            areaColor: '#0a162d',
            borderColor: 'rgba(0, 242, 254, 0.4)',
            borderWidth: 1
          },
          emphasis: {
            label: { color: '#ffffff', fontWeight: 'bold' },
            itemStyle: { areaColor: '#00f2fe' }
          },
          data: mapData
        }
      ]
    };
    mapChart.setOption(option);
  }

  /**
   * 渲染 5 维能力雷达图
   */
  function renderRadar(capabilitySummary) {
    const option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(13, 22, 43, 0.9)',
        borderColor: '#00f2fe',
        textStyle: { color: '#ffffff' }
      },
      radar: {
        indicator: [
          { name: '教学内容生成', max: 100 },
          { name: '多媒体交互课件', max: 100 },
          { name: '学情与数据分析', max: 100 },
          { name: '编程与原型开发', max: 100 },
          { name: '物理实验数字化创新', max: 100 }
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#e2e8f0',
          fontSize: 11,
          fontWeight: 600
        },
        splitLine: {
          lineStyle: { color: 'rgba(0, 242, 254, 0.2)' }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(0, 242, 254, 0.02)', 'rgba(0, 242, 254, 0.06)']
          }
        },
        axisLine: {
          lineStyle: { color: 'rgba(0, 242, 254, 0.3)' }
        }
      },
      series: [
        {
          name: '能力均分画像',
          type: 'radar',
          data: [
            {
              value: capabilitySummary.scores,
              name: '参训教师均分 (0-100)',
              areaStyle: { color: 'rgba(0, 242, 254, 0.35)' },
              lineStyle: { color: '#00f2fe', width: 2 },
              itemStyle: { color: '#00f2fe' }
            }
          ]
        }
      ]
    };
    radarChart.setOption(option);
  }

  /**
   * 渲染教龄与学段结构
   */
  function renderYearsChart(records) {
    const bins = { '0-3年': 0, '4-10年': 0, '11-20年': 0, '20年以上': 0 };
    records.forEach(r => {
      const y = Number(r.basicInfo?.teachingYears) || 0;
      if (y <= 3) bins['0-3年']++;
      else if (y <= 10) bins['4-10年']++;
      else if (y <= 20) bins['11-20年']++;
      else bins['20年以上']++;
    });

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: Object.keys(bins),
        axisLine: { lineStyle: { color: '#4e5d78' } },
        axisLabel: { color: '#8b9bb4', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#8b9bb4' }
      },
      series: [
        {
          name: '教师人数',
          type: 'bar',
          data: Object.values(bins),
          barWidth: '40%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#00f2fe' },
              { offset: 1, color: '#4facfe' }
            ])
          }
        }
      ]
    };
    yearsChart.setOption(option);
  }

  /**
   * 渲染 AI 工具使用排行
   */
  function renderToolsChart(records) {
    const toolCounts = {};
    records.forEach(r => {
      const tools = r.aiUsage?.tools || {};
      [...(tools.domesticGeneral || []), ...(tools.domesticCoding || []), ...(tools.foreignTools || [])].forEach(t => {
        toolCounts[t] = (toolCounts[t] || 0) + 1;
      });
    });

    const sorted = Object.entries(toolCounts)
      .sort((a, b) => a[1] - b[1])
      .slice(-8); // TOP 8

    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '6%', bottom: '3%', top: '5%', containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#8b9bb4' }
      },
      yAxis: {
        type: 'category',
        data: sorted.map(s => s[0]),
        axisLine: { lineStyle: { color: '#4e5d78' } },
        axisLabel: { color: '#e2e8f0', fontSize: 11 }
      },
      series: [
        {
          name: '使用人数',
          type: 'bar',
          data: sorted.map(s => s[1]),
          barWidth: '50%',
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#2ed573' },
              { offset: 1, color: '#10ac84' }
            ])
          }
        }
      ]
    };
    toolsChart.setOption(option);
  }

  /**
   * 渲染物理实验创新需求 TOP 榜
   */
  function renderExpDemandChart(records) {
    const demandCounts = {};
    records.forEach(r => {
      const expNeeds = r.needs?.experimentNeeds || [];
      expNeeds.forEach(item => {
        demandCounts[item] = (demandCounts[item] || 0) + 1;
      });
    });

    const sorted = Object.entries(demandCounts).sort((a, b) => b[1] - a[1]);

    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: sorted.map(s => s[0]),
        axisLine: { lineStyle: { color: '#4e5d78' } },
        axisLabel: { color: '#8b9bb4', fontSize: 10, rotate: 25 }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#8b9bb4' }
      },
      series: [
        {
          name: '诉求教师数',
          type: 'bar',
          data: sorted.map(s => s[1]),
          barWidth: '45%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ffa502' },
              { offset: 1, color: '#ff4757' }
            ])
          }
        }
      ]
    };
    expDemandChart.setOption(option);
  }

  /**
   * 渲染创新项目阶段漏斗
   */
  function renderProjectFunnel(records) {
    const stages = { '暂无想法': 0, '正在构思': 0, '已经尝试': 0, '正在开发': 0, '课堂已应用': 0 };
    records.forEach(r => {
      const s = r.project?.stage || '暂无想法';
      if (stages[s] !== undefined) stages[s]++;
    });

    const funnelData = Object.entries(stages).map(([name, value]) => ({ name, value }));

    const option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} 位教师' },
      series: [
        {
          name: '项目阶段',
          type: 'funnel',
          left: '10%',
          top: '10%',
          bottom: '10%',
          width: '80%',
          minSize: '15%',
          maxSize: '100%',
          sort: 'none',
          gap: 4,
          label: {
            show: true,
            position: 'inside',
            color: '#ffffff',
            fontSize: 11,
            formatter: '{b}: {c}人'
          },
          itemStyle: {
            borderColor: 'rgba(0, 0, 0, 0.4)',
            borderWidth: 1
          },
          data: funnelData
        }
      ]
    };
    projectFunnelChart.setOption(option);
  }

  /**
   * 渲染教师明细表
   */
  function renderTable(records, keyword = '') {
    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '';

    const filtered = records.filter(r => {
      if (!keyword) return true;
      const str = JSON.stringify(r).toLowerCase();
      return str.includes(keyword.toLowerCase());
    });

    document.getElementById('tableCount').innerText = `${filtered.length} / ${records.length}`;

    filtered.forEach(r => {
      const b = r.basicInfo || {};
      const u = r.aiUsage || {};
      const c = RadarCalculator.calculateRecordScores(r.aiCapability);
      const p = r.project || {};

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${b.name || '匿名'}</strong> (${b.gender || '-'})</td>
        <td>${b.school || '-'}</td>
        <td>${b.teachingYears ? b.teachingYears + '年' : '-'}</td>
        <td>${u.experience || '-'}</td>
        <td><span class="tag">${c.overallIndex}分</span></td>
        <td>${c.experimentDev}分</td>
        <td><span class="tag ${p.stage === '正在开发' || p.stage === '课堂已应用' ? 'tag-green' : 'tag-orange'}">${p.stage || '无'}</span></td>
        <td>${p.name || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * 智能讲座建议自动生成
   */
  async function updateAiAdvice(records, capabilitySummary) {
    const result = await AiAnalyser.runAnalysis(records, capabilitySummary);
    document.getElementById('aiEngineLabel').innerText = result.source;
    document.getElementById('aiAdviceContent').innerHTML = result.content;

    // 渲染关键词标签
    const tagBox = document.getElementById('aiKeywordTags');
    tagBox.innerHTML = '';
    result.keywords.forEach(k => {
      const span = document.createElement('span');
      span.className = 'ai-keyword-tag';
      span.innerText = `${k.word} (${k.freq})`;
      tagBox.appendChild(span);
    });
  }

  /**
   * 手动触发深度 AI 研判
   */
  async function runAiDeepAnalysis() {
    const btn = document.getElementById('btnRunAi');
    btn.disabled = true;
    btn.innerText = 'AI 正在研判...';
    const capabilitySummary = RadarCalculator.calculateCohortAverages(rawData);
    await updateAiAdvice(rawData, capabilitySummary);
    btn.disabled = false;
    btn.innerText = '重新智能研判';
  }

  /**
   * 导出数据
   */
  function exportData(format, isAnonymized) {
    const url = `/api/export/${format}?sessionId=${encodeURIComponent(currentSessionId)}&anonymized=${isAnonymized}`;
    window.open(url, '_blank');
  }
});
