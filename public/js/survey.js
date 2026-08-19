/**
 * 教师端手机问卷交互控制器 (Survey Wizard Controller v2.3 - 5步精简版)
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  const totalSteps = 5;
  const STORAGE_KEY = 'ai_teacher_survey_draft_v2';
  const SUBMIT_BACKUP_KEY = 'ai_teacher_survey_submissions_local';

  // 初始化当前批次与表单状态 (能力画像默认不选中任何项)
  const formData = {
    sessionId: '2026-chongming-ai-physics',
    basicInfo: {
      name: '',
      gender: '',
      province: '上海市',
      district: '崇明区',
      school: '',
      schoolAddress: '',
      subject: '物理',
      grades: [],
      teachingYears: '',
      roles: [],
      adminDuty: '无行政职务'
    },
    aiUsage: {
      tools: {
        domesticGeneral: [],
        domesticCoding: [],
        foreignTools: []
      },
      experience: '',
      frequency: ''
    },
    aiCapability: {
      contentGeneration: null,
      multimedia: null,
      dataAnalysis: null,
      programming: null,
      experimentDev: null
    },
    needs: {
      workNeeds: [],
      experimentNeeds: [],
      experimentPainDetail: ''
    },
    project: {
      stage: '暂无想法',
      name: '',
      categories: [],
      difficulties: []
    },
    openResponses: {
      dreamTool: '',
      teachingPainPoint: '',
      lectureExpectation: ''
    }
  };

  // 绑定多选/单选 Chip 点击
  initChipSelection();
  // 绑定 5 级量表评分按钮
  initScaleButtons();
  // 绑定输入框变化监听
  bindInputs();
  // 从 LocalStorage 恢复草稿
  restoreDraft();
  // 渲染当前步骤
  renderStep(currentStep);

  // 导航按钮
  document.getElementById('btnPrev').addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      renderStep(currentStep);
    }
  });

  document.getElementById('btnNext').addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        currentStep++;
        renderStep(currentStep);
        saveDraft();
      }
    }
  });

  document.getElementById('btnSubmit').addEventListener('click', async () => {
    if (validateStep(currentStep)) {
      await submitForm();
    }
  });

  /**
   * 渲染当前步骤视图
   */
  function renderStep(step) {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.querySelectorAll('.step-card').forEach(el => el.classList.remove('active'));
    const targetCard = document.getElementById(`step-${step}`);
    if (targetCard) targetCard.classList.add('active');

    // 进度条与标题
    const fillPercent = (step / totalSteps) * 100;
    document.getElementById('progressFill').style.width = `${fillPercent}%`;
    document.getElementById('progressStepText').innerText = `步骤 ${step} / ${totalSteps}`;

    // 按钮显隐控制
    document.getElementById('btnPrev').style.display = step === 1 ? 'none' : 'inline-flex';
    document.getElementById('btnNext').style.display = step === totalSteps ? 'none' : 'inline-flex';
    document.getElementById('btnSubmit').style.display = step === totalSteps ? 'inline-flex' : 'none';
  }

  /**
   * 步骤表单校验
   */
  function validateStep(step) {
    if (step === 1) {
      if (!formData.basicInfo.gender) {
        alert('请选择性别');
        return false;
      }
      const school = document.getElementById('input-school').value.trim();
      if (!school) {
        alert('请填写所在学校名称（如：上海市崇明中学）');
        document.getElementById('input-school').focus();
        return false;
      }
      formData.basicInfo.school = school;
      formData.basicInfo.name = document.getElementById('input-name').value.trim() || '匿名教师';
      formData.basicInfo.district = document.getElementById('input-district').value.trim() || '崇明区';
      formData.basicInfo.schoolAddress = document.getElementById('input-schoolAddress').value.trim();
      formData.basicInfo.subject = document.getElementById('input-subject').value.trim() || '物理';
      formData.basicInfo.teachingYears = Number(document.getElementById('input-teachingYears').value) || 0;
      return true;
    }

    if (step === 2) {
      if (!formData.aiUsage.experience) {
        alert('请选择 AI 使用经验年限');
        return false;
      }
      if (!formData.aiUsage.frequency) {
        alert('请选择 AI 使用频率');
        return false;
      }
      return true;
    }

    if (step === 3) {
      const { contentGeneration, multimedia, dataAnalysis, programming, experimentDev } = formData.aiCapability;
      if (!contentGeneration || !multimedia || !dataAnalysis || !programming || !experimentDev) {
        alert('请为全部 5 项 AI 应用能力完成自评打分');
        return false;
      }
      return true;
    }

    if (step === 4) {
      formData.needs.experimentPainDetail = document.getElementById('input-experimentPainDetail').value.trim();
      return true;
    }

    if (step === 5) {
      formData.project.name = document.getElementById('input-projectName').value.trim();
      formData.openResponses.dreamTool = document.getElementById('input-dreamTool').value.trim();
      formData.openResponses.lectureExpectation = document.getElementById('input-lectureExpectation').value.trim();
      return true;
    }

    return true;
  }

  /**
   * 初始化 Chip 选择交互
   */
  function initChipSelection() {
    document.querySelectorAll('.select-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const group = chip.dataset.group;
        const val = chip.dataset.value;
        const isMulti = chip.dataset.multi === 'true';

        if (isMulti) {
          chip.classList.toggle('active');
          const targetArray = getNestedArray(group);
          if (chip.classList.contains('active')) {
            if (!targetArray.includes(val)) targetArray.push(val);
          } else {
            const idx = targetArray.indexOf(val);
            if (idx > -1) targetArray.splice(idx, 1);
          }
        } else {
          // 单选
          document.querySelectorAll(`.select-chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          setNestedValue(group, val);
        }
        saveDraft();
      });
    });

    // 绑定预填快捷标签点击
    document.querySelectorAll('.quick-tag-chip').forEach(tag => {
      tag.addEventListener('click', () => {
        const targetInputId = tag.dataset.target;
        const val = tag.dataset.value;
        const input = document.getElementById(targetInputId);
        if (input) {
          input.value = val;
          input.dispatchEvent(new Event('input'));
        }
      });
    });
  }

  /**
   * 初始化 5 级量表评分按钮
   */
  function initScaleButtons() {
    document.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dim = btn.dataset.dim;
        const score = Number(btn.dataset.score);

        document.querySelectorAll(`.scale-btn[data-dim="${dim}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        formData.aiCapability[dim] = score;
        saveDraft();
      });
    });
  }

  /**
   * 绑定文本输入同步
   */
  function bindInputs() {
    const inputMap = [
      { id: 'input-name', path: 'basicInfo.name' },
      { id: 'input-district', path: 'basicInfo.district' },
      { id: 'input-school', path: 'basicInfo.school' },
      { id: 'input-schoolAddress', path: 'basicInfo.schoolAddress' },
      { id: 'input-subject', path: 'basicInfo.subject' },
      { id: 'input-teachingYears', path: 'basicInfo.teachingYears' },
      { id: 'input-experimentPainDetail', path: 'needs.experimentPainDetail' },
      { id: 'input-projectName', path: 'project.name' },
      { id: 'input-dreamTool', path: 'openResponses.dreamTool' },
      { id: 'input-lectureExpectation', path: 'openResponses.lectureExpectation' }
    ];

    inputMap.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('input', (e) => {
          setNestedValue(item.path, e.target.value);
          saveDraft();
        });
      }
    });
  }

  function getNestedArray(path) {
    const keys = path.split('.');
    let obj = formData;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    return obj[keys[keys.length - 1]];
  }

  function setNestedValue(path, value) {
    const keys = path.split('.');
    let obj = formData;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {}
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(formData, saved);

        // 还原 input 框内容
        if (formData.basicInfo.name) document.getElementById('input-name').value = formData.basicInfo.name;
        if (formData.basicInfo.district) document.getElementById('input-district').value = formData.basicInfo.district;
        if (formData.basicInfo.school) document.getElementById('input-school').value = formData.basicInfo.school;
        if (formData.basicInfo.schoolAddress) document.getElementById('input-schoolAddress').value = formData.basicInfo.schoolAddress;
        if (formData.basicInfo.subject) document.getElementById('input-subject').value = formData.basicInfo.subject;
        if (formData.basicInfo.teachingYears) document.getElementById('input-teachingYears').value = formData.basicInfo.teachingYears;
        if (formData.needs.experimentPainDetail) document.getElementById('input-experimentPainDetail').value = formData.needs.experimentPainDetail;
        if (formData.project.name) document.getElementById('input-projectName').value = formData.project.name;
        if (formData.openResponses.dreamTool) document.getElementById('input-dreamTool').value = formData.openResponses.dreamTool;
        if (formData.openResponses.lectureExpectation) document.getElementById('input-lectureExpectation').value = formData.openResponses.lectureExpectation;

        // 还原单选/多选高亮
        document.querySelectorAll('.select-chip').forEach(chip => {
          const group = chip.dataset.group;
          const val = chip.dataset.value;
          const isMulti = chip.dataset.multi === 'true';
          if (isMulti) {
            const arr = getNestedArray(group);
            if (arr && arr.includes(val)) chip.classList.add('active');
          } else {
            const currentVal = getNestedArray(group);
            if (currentVal === val) chip.classList.add('active');
          }
        });

        // 还原评分高亮 (仅当有明确保存值时)
        if (formData.aiCapability) {
          Object.entries(formData.aiCapability).forEach(([dim, score]) => {
            if (score) {
              const btn = document.querySelector(`.scale-btn[data-dim="${dim}"][data-score="${score}"]`);
              if (btn) btn.classList.add('selected');
            }
          });
        }
      }
    } catch (e) {}
  }

  /**
   * 提交表单至后端服务
   */
  async function submitForm() {
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.innerText = '正在提交...';

    formData.submittedAt = new Date().toISOString();
    formData.id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 优先提交到后端 API
    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch (e) {
      console.warn('本地服务连接失败，已转存至离线 LocalStorage。', e);
    }

    // 本地持久化备份
    try {
      const localBackups = JSON.parse(localStorage.getItem(SUBMIT_BACKUP_KEY) || '[]');
      localBackups.push(formData);
      localStorage.setItem(SUBMIT_BACKUP_KEY, JSON.stringify(localBackups));
      localStorage.removeItem(STORAGE_KEY); // 清空草稿
    } catch (e) {}

    // 显示提交成功页
    showSuccessScreen();
  }

  function showSuccessScreen() {
    document.querySelectorAll('.step-card').forEach(el => el.classList.remove('active'));
    document.querySelector('.progress-container').style.display = 'none';
    document.querySelector('.wizard-nav').style.display = 'none';

    const successEl = document.getElementById('successScreen');
    successEl.style.display = 'block';

    document.getElementById('resTeacherName').innerText = formData.basicInfo.name || '参训教师';
    document.getElementById('resSchool').innerText = formData.basicInfo.school || '上海市崇明区';
    document.getElementById('resExp').innerText = formData.aiUsage.experience || '初次体验';
    document.getElementById('resProject').innerText = formData.project.stage || '正在构思';
  }
});
