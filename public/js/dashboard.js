/**
 * 讲师实时大屏看板控制器 (Dashboard Controller v2.2 - 完全对标原版视觉与交互)
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentSessionId = '2026-chongming-ai-physics';
  let rawData = [];
  let pollTimer = null;
  let currentMapView = 'shanghai'; // 'shanghai' | 'chongming'
  let chongmingSchools = [];
  let currentAiEngine = 'ollama'; // 'ollama' | 'rule'

  // ECharts 实例引用
  let mapChart = null;
  let radarChart = null;
  let yearsChart = null;
  let toolsChart = null;
  let expDemandChart = null;
  let projectFunnelChart = null;

  // 启动时钟
  startLiveClock();

  // 初始化地图与图表
  await initMapGeoJSON();
  await loadChongmingSchools();
  initCharts();
  await loadSessions();
  await refreshData(false);

  // 启动 3.5 秒自动轮询
  pollTimer = setInterval(() => refreshData(false), 3500);

  // 窗口缩放自适应
  window.addEventListener('resize', () => {
    [mapChart, radarChart, yearsChart, toolsChart, expDemandChart, projectFunnelChart].forEach(c => c && c.resize());
  });

  // 绑定交互事件
  document.getElementById('sessionSelect').addEventListener('change', (e) => {
    currentSessionId = e.target.value;
    refreshData(true);
  });

  // 刷新按钮 (带旋转动画与明确反馈)
  document.getElementById('btnRefresh').addEventListener('click', () => {
    refreshData(true);
  });

  // 载入测试模拟数据按钮
  document.getElementById('btnLoadMock').addEventListener('click', loadMockData);

  // 清空数据按钮
  document.getElementById('btnClearData').addEventListener('click', clearCurrentSessionData);

  // 地图切换按钮
  document.getElementById('btnMapShanghai').addEventListener('click', () => switchMapView('shanghai'));
  document.getElementById('btnMapChongming').addEventListener('click', () => switchMapView('chongming'));

  // 引擎切换
  document.getElementById('tabOllama').addEventListener('click', () => {
    currentAiEngine = 'ollama';
    document.getElementById('tabOllama').classList.add('active');
    document.getElementById('tabRule').classList.remove('active');
    runAiDeepAnalysis();
  });
  document.getElementById('tabRule').addEventListener('click', () => {
    currentAiEngine = 'rule';
    document.getElementById('tabRule').classList.add('active');
    document.getElementById('tabOllama').classList.remove('active');
    runAiDeepAnalysis();
  });

  // 导出按钮
  document.getElementById('btnExportCsv').addEventListener('click', () => exportData('csv', false));
  document.getElementById('btnExportAnonCsv').addEventListener('click', () => exportData('csv', true));
  document.getElementById('btnRunAi').addEventListener('click', runAiDeepAnalysis);

  // 表格搜索过滤
  document.getElementById('tableSearchInput').addEventListener('input', (e) => {
    renderTable(rawData, e.target.value.trim());
  });

  /**
   * 实时时钟
   */
  function startLiveClock() {
    const clockEl = document.getElementById('liveClock');
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      if (clockEl) clockEl.innerText = `${h}:${m}:${s}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  /**
   * 注册官方真实 GeoJSON 地图数据
   */
  async function initMapGeoJSON() {
    try {
      const [shRes, cmRes] = await Promise.all([
        fetch('/public/maps/shanghai.json'),
        fetch('/public/maps/chongming.json')
      ]);

      if (shRes.ok) {
        const shanghaiJson = await shRes.json();
        echarts.registerMap('shanghai', shanghaiJson);
      }
      if (cmRes.ok) {
        const chongmingJson = await cmRes.json();
        echarts.registerMap('chongming', chongmingJson);
      }
    } catch (e) {
      console.warn('加载真实 GeoJSON 地图数据异常', e);
    }
  }

  /**
   * 加载崇明学校坐标库
   */
  async function loadChongmingSchools() {
    try {
      const res = await fetch('/public/maps/chongming-schools.json');
      if (res.ok) {
        chongmingSchools = await res.json();
      }
    } catch (e) {}
  }

  /**
   * 初始化所有 ECharts 实例
   */
  function initCharts() {
    mapChart = echarts.init(document.getElementById('mapChart'));
    radarChart = echarts.init(document.getElementById('radarChart'));
    yearsChart = echarts.init(document.getElementById('yearsChart'));
    toolsChart = echarts.init(document.getElementById('toolsChart'));
    expDemandChart = echarts.init(document.getElementById('expDemandChart'));
    projectFunnelChart = echarts.init(document.getElementById('projectFunnelChart'));

    // 地图点击下钻交互
    mapChart.on('click', (params) => {
      if (currentMapView === 'shanghai' && params.name && params.name.includes('崇明')) {
        switchMapView('chongming');
      }
    });
  }

  /**
   * 切换地图展示视图
   */
  function switchMapView(viewName) {
    currentMapView = viewName;
    document.getElementById('btnMapShanghai').classList.toggle('active', viewName === 'shanghai');
    document.getElementById('btnMapChongming').classList.toggle('active', viewName === 'chongming');
    renderMap(rawData);
  }

  /**
   * 浮动 Toast 提示
   */
  function showToast(message, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) {
      toast.style.borderColor = '#ff4757';
      toast.style.color = '#ff6b81';
      toast.innerHTML = `<span>⚠️ ${message}</span>`;
    } else {
      toast.innerHTML = `<span>✨ ${message}</span>`;
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /**
   * 加载 Session 批次
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
  async function refreshData(showFeedback = false) {
    try {
      const res = await fetch(`/api/data?sessionId=${encodeURIComponent(currentSessionId)}`);
      if (res.ok) {
        const json = await res.json();
        rawData = json.data || [];
        updateDashboard(rawData);
        if (showFeedback) {
          showToast(`数据已刷新！当前批次共 ${rawData.length} 位教师已提交`);
        }
      }
    } catch (e) {
      console.warn('获取最新数据失败', e);
      if (showFeedback) {
        showToast('连接本地服务超时，请检查服务是否运行', true);
      }
    }
  }

  /**
   * 载入测试模拟数据
   */
  async function loadMockData() {
    try {
      const res = await fetch(`/api/seed?sessionId=${encodeURIComponent(currentSessionId)}`, {
        method: 'POST'
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`已成功载入 ${result.count} 条测试模拟数据！`);
        await refreshData(false);
      }
    } catch (e) {
      showToast('载入模拟数据失败: ' + e.message, true);
    }
  }

  /**
   * 清空当前批次数据
   */
  async function clearCurrentSessionData() {
    const confirmClear = confirm(`⚠️ 警告：您确定要清空当前批次 [${currentSessionId}] 的所有教师提交记录吗？\n\n此操作将重置所有看板统计为 0 条，不可撤销！`);
    if (!confirmClear) return;

    try {
      const res = await fetch(`/api/clear?sessionId=${encodeURIComponent(currentSessionId)}`, {
        method: 'POST'
      });
      if (res.ok) {
        rawData = [];
        updateDashboard(rawData);
        showToast('当前批次数据池已彻底清空重置为 0 条！');
      } else {
        showToast('清空数据失败', true);
      }
    } catch (e) {
      showToast('清空请求异常: ' + e.message, true);
    }
  }

  /**
   * 驱动全看板更新
   */
  function updateDashboard(records) {
    updateKPIs(records);
    renderMap(records);
    const capabilitySummary = RadarCalculator.calculateCohortAverages(records);
    renderRadar(capabilitySummary);
    renderYearsChart(records);
    renderToolsChart(records);
    renderExpDemandChart(records);
    renderProjectFunnel(records);
    renderTable(records, document.getElementById('tableSearchInput').value.trim());
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
      return;
    }

    const totalYears = records.reduce((acc, r) => acc + (Number(r.basicInfo?.teachingYears) || 0), 0);
    document.getElementById('kpiAvgYears').innerText = (totalYears / N).toFixed(1);

    const aiUsers = records.filter(r => r.aiUsage?.experience && r.aiUsage.experience !== '从未使用').length;
    document.getElementById('kpiAiRate').innerText = `${Math.round((aiUsers / N) * 100)}%`;
  }

  /**
   * 渲染地图 (支持上海全市区级热力图与崇明区专属放大散点图)
   */
  function renderMap(records) {
    if (currentMapView === 'shanghai') {
      const districtCount = {};
      records.forEach(r => {
        const dist = r.basicInfo?.district || '崇明区';
        districtCount[dist] = (districtCount[dist] || 0) + 1;
      });

      const mapData = Object.entries(districtCount).map(([name, value]) => ({ name, value }));

      const option = {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            const val = params.value || 0;
            return `<strong>${params.name}</strong><br/>参训教师: ${val} 人${params.name.includes('崇明') ? '<br/><span style="color:#00f2fe;">(点击可下钻放大查看学校)</span>' : ''}`;
          },
          backgroundColor: 'rgba(13, 22, 43, 0.95)',
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
          inRange: { color: ['#0a162d', '#0072ff', '#00f2fe'] },
          calculable: true
        },
        series: [
          {
            name: '教师区级分布',
            type: 'map',
            map: 'shanghai',
            roam: true,
            zoom: 1.15,
            center: [121.47, 31.45],
            label: {
              show: true,
              color: '#e2e8f0',
              fontSize: 10
            },
            itemStyle: {
              areaColor: '#0a162d',
              borderColor: 'rgba(0, 242, 254, 0.45)',
              borderWidth: 1.2
            },
            emphasis: {
              label: { color: '#ffffff', fontWeight: 'bold' },
              itemStyle: { areaColor: '#00d2d3' }
            },
            data: mapData
          }
        ]
      };
      mapChart.setOption(option, true);
    } else {
      const schoolCounts = {};
      records.forEach(r => {
        const sch = r.basicInfo?.school;
        if (sch) {
          schoolCounts[sch] = (schoolCounts[sch] || 0) + 1;
        }
      });

      const scatterData = [];
      chongmingSchools.forEach(s => {
        const count = schoolCounts[s.name] || 0;
        scatterData.push({
          name: s.name,
          value: [...s.coord, count],
          address: s.address
        });
      });

      const option = {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
              const count = params.value[2] || 0;
              return `<strong>🏫 ${params.name}</strong><br/>提交教师: <span style="color:#00f2fe;font-weight:bold;">${count}</span> 人<br/>地址: ${params.data.address || '崇明区'}`;
            }
            return `<strong>${params.name}</strong><br/>崇明三岛区域`;
          },
          backgroundColor: 'rgba(13, 22, 43, 0.95)',
          borderColor: '#00f2fe',
          textStyle: { color: '#ffffff' }
        },
        geo: {
          map: 'chongming',
          roam: true,
          zoom: 1.25,
          center: [121.58, 31.58],
          label: { show: false },
          itemStyle: {
            areaColor: 'rgba(0, 242, 254, 0.08)',
            borderColor: '#00f2fe',
            borderWidth: 1.5,
            shadowColor: 'rgba(0, 242, 254, 0.3)',
            shadowBlur: 15
          },
          emphasis: {
            itemStyle: { areaColor: 'rgba(0, 242, 254, 0.2)' }
          }
        },
        series: [
          {
            name: '重点学校分布',
            type: 'effectScatter',
            coordinateSystem: 'geo',
            data: scatterData.filter(d => d.value[2] > 0),
            symbolSize: (val) => Math.max(12, Math.min(28, 12 + val[2] * 4)),
            showEffectOn: 'render',
            rippleEffect: { brushType: 'stroke', scale: 3 },
            itemStyle: { color: '#00f2fe', shadowBlur: 10, shadowColor: '#00f2fe' },
            label: {
              show: true,
              formatter: '{b}',
              position: 'right',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 600
            },
            zlevel: 2
          },
          {
            name: '其他学校定位',
            type: 'scatter',
            coordinateSystem: 'geo',
            data: scatterData.filter(d => d.value[2] === 0),
            symbolSize: 8,
            itemStyle: { color: '#8b9bb4', opacity: 0.6 },
            label: { show: false },
            zlevel: 1
          }
        ]
      };
      mapChart.setOption(option, true);
    }
  }

  /**
   * 渲染 5 维能力雷达图
   */
  function renderRadar(capabilitySummary) {
    const option = {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const vals = params.value || [0, 0, 0, 0, 0];
          return `
            <div style="font-weight: bold; margin-bottom: 6px; color: #00f2fe;">教师 AI 创新能力画像 (标准分 0-100)</div>
            <div>• AI 教学设计与内容生成: <strong>${vals[0]}</strong> 分</div>
            <div>• AI 多媒体与动态情境呈现: <strong>${vals[1]}</strong> 分</div>
            <div>• AI 学情诊断与实验数据分析: <strong>${vals[2]}</strong> 分</div>
            <div>• AI 协作编程与教学工具开发: <strong>${vals[3]}</strong> 分</div>
            <div>• AI 赋能物理实验与传感创新: <strong>${vals[4]}</strong> 分</div>
          `;
        },
        backgroundColor: 'rgba(13, 22, 43, 0.95)',
        borderColor: '#00f2fe',
        textStyle: { color: '#ffffff' }
      },
      radar: {
        indicator: [
          { name: '教学内容生成', max: 100 },
          { name: '多媒体动态情境', max: 100 },
          { name: '学情与数据分析', max: 100 },
          { name: '协作编程开发', max: 100 },
          { name: '物理实验传感', max: 100 }
        ],
        shape: 'polygon',
        splitNumber: 4,
        radius: '65%',
        axisName: {
          color: '#e2e8f0',
          fontSize: 10,
          fontWeight: 500
        },
        splitLine: { lineStyle: { color: 'rgba(0, 242, 254, 0.2)' } },
        splitArea: {
          show: true,
          areaStyle: { color: ['rgba(0, 242, 254, 0.02)', 'rgba(0, 242, 254, 0.06)'] }
        },
        axisLine: { lineStyle: { color: 'rgba(0, 242, 254, 0.3)' } }
      },
      series: [
        {
          name: '能力均分画像',
          type: 'radar',
          data: [
            {
              value: capabilitySummary.scores,
              name: '均分(0-100)',
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
    const bins = { '0-3年': 0, '4-10年': 0, '11-20年': 0, '20年+': 0 };
    records.forEach(r => {
      const y = Number(r.basicInfo?.teachingYears) || 0;
      if (y <= 3) bins['0-3年']++;
      else if (y <= 10) bins['4-10年']++;
      else if (y <= 20) bins['11-20年']++;
      else bins['20年+']++;
    });

    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: Object.keys(bins),
        axisLine: { lineStyle: { color: '#4e5d78' } },
        axisLabel: { color: '#8b9bb4', fontSize: 10 }
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
          barWidth: '45%',
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
      .slice(-6);

    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
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
        axisLabel: { color: '#e2e8f0', fontSize: 10 }
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

    const sorted = Object.entries(demandCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '20%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: sorted.map(s => s[0]),
        axisLine: { lineStyle: { color: '#4e5d78' } },
        axisLabel: { color: '#8b9bb4', fontSize: 9, rotate: 20 }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#8b9bb4' }
      },
      series: [
        {
          name: '诉求人数',
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
          left: '5%',
          top: '8%',
          bottom: '8%',
          width: '90%',
          minSize: '12%',
          maxSize: '100%',
          sort: 'none',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            color: '#ffffff',
            fontSize: 10,
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
   * 渲染教师明细表 (完全对齐原版表头与高亮)
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

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color: var(--text-muted); padding: 24px;">暂无提交数据（可点击右上角【载入测试模拟数据】演示）</td></tr>`;
      return;
    }

    filtered.forEach((r, idx) => {
      const b = r.basicInfo || {};
      const c = RadarCalculator.calculateRecordScores(r.aiCapability);
      const p = r.project || {};
      const o = r.openResponses || {};
      const n = r.needs || {};

      const gradesStr = (b.grades || []).join('/') || '-';
      const roleAdminStr = [
        (b.roles || []).join('/'),
        (b.adminDuty && b.adminDuty !== '无行政职务' ? b.adminDuty : '')
      ].filter(Boolean).join(' | ') || '教师';

      const concernStr = o.lectureExpectation || o.dreamTool || n.experimentPainDetail || '探索AI在物理实验中的应用';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--accent-cyan); font-weight: 700;">${idx + 1}</td>
        <td><strong>${b.name || '匿名'}</strong></td>
        <td>${b.gender || '-'}</td>
        <td><span style="color: var(--accent-cyan);">${b.subject || '物理'}</span></td>
        <td>${gradesStr}</td>
        <td>${b.teachingYears ? b.teachingYears + ' 年' : '-'}</td>
        <td>${b.school || '-'}</td>
        <td><span style="color: #a0aec0; font-size: 0.8rem;">${roleAdminStr}</span></td>
        <td><span class="tag">${c.overallIndex} 分</span></td>
        <td>${c.experimentDev} 分</td>
        <td><span class="tag ${p.stage === '正在开发' || p.stage === '课堂已应用' ? 'tag-green' : 'tag-orange'}">${p.stage || '无'}</span></td>
        <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${concernStr}">${concernStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * 智能讲座建议与实时消息流自动生成
   */
  async function updateAiAdvice(records, capabilitySummary) {
    const result = await AiAnalyser.runAnalysis(records, capabilitySummary);
    document.getElementById('aiStatusLabel').innerText = result.source;

    // 渲染关键词发光云
    const wordCloudBox = document.getElementById('aiWordCloud');
    if (result.keywords && result.keywords.length > 0) {
      wordCloudBox.innerHTML = '';
      result.keywords.forEach((k, idx) => {
        const span = document.createElement('span');
        const levelClass = idx < 2 ? 'level-1' : (idx < 5 ? 'level-2' : 'level-3');
        span.className = `ai-cloud-word ${levelClass}`;
        span.innerText = `${k.word} (${k.freq})`;
        wordCloudBox.appendChild(span);
      });
    }

    // 渲染实时消息滚动流
    const streamBox = document.getElementById('aiStreamBox');
    streamBox.innerHTML = '';
    
    if (records.length === 0) {
      streamBox.innerHTML = `<div class="ai-stream-item"><span class="ai-stream-time">[系统]</span> 正在等待教师提交或载入模拟数据以开展深度语义提炼...</div>`;
      return;
    }

    // 提取最新教师的真实诉求
    records.slice(-4).reverse().forEach(r => {
      const b = r.basicInfo || {};
      const o = r.openResponses || {};
      const n = r.needs || {};
      const timeStr = r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : '11:20:00';
      const text = o.lectureExpectation || o.teachingPainPoint || n.experimentPainDetail || o.dreamTool || '探索AI在物理实验中的应用';

      const div = document.createElement('div');
      div.className = 'ai-stream-item';
      div.innerHTML = `<span class="ai-stream-time">[${timeStr}]</span> <strong>${b.name || '教师'}</strong> (${b.school || '中学'}): ${text}`;
      streamBox.appendChild(div);
    });
  }

  /**
   * 手动触发深度 AI 研判
   */
  async function runAiDeepAnalysis() {
    const btn = document.getElementById('btnRunAi');
    btn.innerText = 'AI 正在研判...';
    const capabilitySummary = RadarCalculator.calculateCohortAverages(rawData);
    await updateAiAdvice(rawData, capabilitySummary);
    btn.innerText = '⚡ AI 分析核心需求';
    showToast('AI 核心关注与现场讲座调优策略已更新！');
  }

  /**
   * 导出数据
   */
  function exportData(format, isAnonymized) {
    const url = `/api/export/${format}?sessionId=${encodeURIComponent(currentSessionId)}&anonymized=${isAnonymized}`;
    window.open(url, '_blank');
    showToast(`已触发导出 ${isAnonymized ? '【学术脱敏版】' : '【全量明细】'} ${format.toUpperCase()}`);
  }

  // 绑定二维码弹窗与网络信息
  initQrModal();

  function initQrModal() {
    const btnShowQr = document.getElementById('btnShowQr');
    const btnCloseQr = document.getElementById('btnCloseQr');
    const qrModal = document.getElementById('qrModal');
    let qrInstance = null;

    if (!btnShowQr || !qrModal) return;

    btnShowQr.addEventListener('click', async () => {
      qrModal.style.display = 'flex';
      await loadNetworkInfo();
    });

    btnCloseQr.addEventListener('click', () => {
      qrModal.style.display = 'none';
    });

    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) qrModal.style.display = 'none';
    });

    // 复制按钮
    document.getElementById('btnCopyPublic')?.addEventListener('click', () => {
      const input = document.getElementById('publicSurveyUrl');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('外网问卷链接已复制到剪贴板！');
      }
    });

    document.getElementById('btnCopyLocal')?.addEventListener('click', () => {
      const input = document.getElementById('localSurveyUrl');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('局域网问卷链接已复制到剪贴板！');
      }
    });

    async function loadNetworkInfo() {
      try {
        const res = await fetch('/api/network-info');
        const info = await res.json();
        
        const publicInput = document.getElementById('publicSurveyUrl');
        const localInput = document.getElementById('localSurveyUrl');
        if (publicInput) publicInput.value = info.surveyUrl || window.location.origin + '/';
        if (localInput) localInput.value = info.localUrl || `http://${info.localIp}:3000/`;

        const badge = document.getElementById('qrTunnelStatus');
        if (badge) {
          if (info.hasTunnel && info.tunnelUrl) {
            badge.innerText = '🌐 外网 HTTPS 穿透已就绪';
            badge.style.borderColor = '#2ed573';
            badge.style.color = '#2ed573';
          } else {
            badge.innerText = '📶 本地局域网服务运行中';
            badge.style.borderColor = '#00f2fe';
            badge.style.color = '#00f2fe';
          }
        }

        // 生成二维码
        const qrContainer = document.getElementById('qrCodeContainer');
        const targetUrl = info.surveyUrl || window.location.origin + '/';
        if (!qrInstance && typeof QRCode !== 'undefined') {
          qrInstance = new QRCode(qrContainer, {
            text: targetUrl,
            width: 200,
            height: 200
          });
        } else if (qrInstance) {
          qrInstance.makeCode(targetUrl);
        }
      } catch (e) {
        console.error('加载网络信息失败', e);
      }
    }
  }
});
