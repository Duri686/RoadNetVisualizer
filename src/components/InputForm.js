/**
 * Input Form Component
 * 处理用户输入和表单验证
 */

class InputForm {
  constructor() {
    this.elements = {
      widthInput: document.getElementById('width-input'),
      heightInput: document.getElementById('height-input'),
      layerInput: document.getElementById('layer-input'),
      floorEntranceInput: document.getElementById('floor-entrance-input'),
      floorEntranceGroup: document.getElementById('floor-entrance-group'),
      obstacleInput: document.getElementById('obstacle-input'),
      generateBtn: document.getElementById('generate-btn'),
      modeOptions: document.querySelectorAll('.mode-option'),
    };

    this.onSubmitCallback = null;
    this.isDisabled = false;
    this._btnOriginalHTML = null; // 按钮原始内容

    this.init();
  }

  /**
   * 初始化表单
   */
  init() {
    // 验证元素是否存在
    if (
      !this.elements.widthInput ||
      !this.elements.heightInput ||
      !this.elements.layerInput ||
      !this.elements.obstacleInput ||
      !this.elements.generateBtn
    ) {
      console.error('❌ Required form elements not found');
      return;
    }

    // 绑定事件
    this.elements.generateBtn.addEventListener('click', () =>
      this.handleSubmit(),
    );

    // 添加回车键提交
    const inputs = [
      this.elements.widthInput,
      this.elements.heightInput,
      this.elements.layerInput,
      this.elements.obstacleInput,
    ];
    inputs.forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit();
        }
      });
    });

    // 模式checkbox互斥：仅允许单选，至少保持一个被选中
    if (this.elements.modeOptions && this.elements.modeOptions.length) {
      this.elements.modeOptions.forEach((cb) => {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            this.elements.modeOptions.forEach((other) => {
              if (other !== cb) other.checked = false;
            });
          } else {
            // 确保至少一个选中
            const anyChecked = Array.from(this.elements.modeOptions).some(
              (x) => x.checked,
            );
            if (!anyChecked) cb.checked = true;
          }
        });
      });
    }

    // 添加实时验证
    inputs.forEach((input) => {
      input.addEventListener('input', () => this.validateInputs());
    });

    // 监听楼层数变化,动态显示/隐藏楼层出入口输入框
    if (this.elements.layerInput && this.elements.floorEntranceGroup) {
      this.elements.layerInput.addEventListener('input', () => {
        const floors = parseInt(this.elements.layerInput.value, 10);
        if (floors > 1 && !isNaN(floors)) {
          this.elements.floorEntranceGroup.style.display = 'block';
        } else {
          this.elements.floorEntranceGroup.style.display = 'none';
        }
      });
      // 初始检查
      const initialFloors = parseInt(this.elements.layerInput.value, 10);
      if (initialFloors > 1) {
        this.elements.floorEntranceGroup.style.display = 'block';
      }
    }

    console.log('✅ Input form initialized');
  }

  /**
   * 处理表单提交
   */
  handleSubmit() {
    if (this.isDisabled) {
      console.warn('⚠️ Form is disabled');
      return;
    }

    const values = this.getValues();

    // 验证输入
    const validation = this.validate(values);
    if (!validation.valid) {
      alert(`❌ 输入错误: ${validation.errors.join(', ')}`);
      return;
    }

    // 调用回调函数
    if (this.onSubmitCallback) {
      this.onSubmitCallback(values);
    }
  }

  /**
   * 获取表单值
   */
  getValues() {
    // 读取模式：互斥checkbox组
    let mode = 'centroid';
    if (this.elements.modeOptions && this.elements.modeOptions.length) {
      const checked = Array.from(this.elements.modeOptions).find(
        (cb) => cb.checked,
      );
      if (checked && checked.dataset && checked.dataset.value) {
        mode = checked.dataset.value;
      }
    }

    return {
      width: parseInt(this.elements.widthInput.value, 10),
      height: parseInt(this.elements.heightInput.value, 10),
      layerCount: parseInt(this.elements.layerInput.value, 10),
      obstacleCount: parseInt(this.elements.obstacleInput.value, 10),
      floorEntranceCount: (() => {
        if (!this.elements.floorEntranceInput) return 4;
        const v = parseInt(this.elements.floorEntranceInput.value, 10);
        return isNaN(v) ? 4 : Math.max(2, Math.min(10, v)); // Clamp 2-10
      })(),
      mode,
      useSpatialIndex: !!document.getElementById('use-spatial-index')?.checked,
      cellSize: (() => {
        const el = document.getElementById('cell-size-input');
        if (!el) return undefined;
        const v = parseInt(el.value, 10);
        return isNaN(v) ? undefined : Math.max(4, v);
      })(),
      // 静态缓存与裁剪
      staticCache: !!document.getElementById('static-cache')?.checked,
      cullingEnabled: !!document.getElementById('culling-enabled')?.checked,
      cullingMargin: (() => {
        const el = document.getElementById('culling-margin-input');
        if (!el) return undefined;
        const v = parseInt(el.value, 10);
        return isNaN(v) ? undefined : Math.max(0, v);
      })(),
    };
  }

  /**
   * 验证输入值
   */
  validate(values) {
    const errors = [];

    if (isNaN(values.width) || values.width < 10 || values.width > 100000) {
      errors.push('宽度必须在 10-100000 之间');
    }

    if (isNaN(values.height) || values.height < 10 || values.height > 100000) {
      errors.push('高度必须在 10-100000 之间');
    }

    if (
      isNaN(values.layerCount) ||
      values.layerCount < 1 ||
      values.layerCount > 10
    ) {
      errors.push('层数必须在 1-10 之间');
    }

    // 障碍物数量：放开上限，但不得为负
    if (isNaN(values.obstacleCount) || values.obstacleCount < 0) {
      errors.push('障碍物数量必须为非负整数');
    }

    // 移除密度硬限制：仅在控制台告警，不阻塞生成
    // const totalGridCells = (values.width / 5) * (values.height / 5);
    // if (values.obstacleCount > totalGridCells * 0.5) {
    //   console.warn(`障碍物较多（建议 ≤ ${Math.floor(totalGridCells * 0.5)}），可能导致端到端耗时上升`);
    // }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 实时验证输入
   */
  validateInputs() {
    const values = this.getValues();
    const validation = this.validate(values);

    // 更新按钮状态
    if (!validation.valid && !this.isDisabled) {
      this.elements.generateBtn.style.opacity = '0.6';
    } else if (!this.isDisabled) {
      this.elements.generateBtn.style.opacity = '1';
    }
  }

  /**
   * 注册提交回调
   */
  onSubmit(callback) {
    this.onSubmitCallback = callback;
  }

  /**
   * 禁用表单
   */
  disable() {
    this.isDisabled = true;
    this.elements.widthInput.disabled = true;
    this.elements.heightInput.disabled = true;
    this.elements.layerInput.disabled = true;
    // 同步禁用障碍物输入，避免生成期间误操作
    this.elements.obstacleInput.disabled = true;
    this.elements.generateBtn.disabled = true;
    if (this.elements.modeOptions && this.elements.modeOptions.length) {
      this.elements.modeOptions.forEach((cb) => {
        cb.disabled = true;
      });
    }
    this.setButtonLoading(true);
  }

  /**
   * 启用表单
   */
  enable() {
    this.isDisabled = false;
    this.elements.widthInput.disabled = false;
    this.elements.heightInput.disabled = false;
    this.elements.layerInput.disabled = false;
    // 重新启用障碍物输入
    this.elements.obstacleInput.disabled = false;
    this.elements.generateBtn.disabled = false;
    if (this.elements.modeOptions && this.elements.modeOptions.length) {
      this.elements.modeOptions.forEach((cb) => {
        cb.disabled = false;
      });
    }
    this.setButtonLoading(false);
  }

  /**
   * 重置表单
   */
  reset() {
    this.elements.widthInput.value = '50';
    this.elements.heightInput.value = '50';
    this.elements.layerInput.value = '3';
    this.elements.obstacleInput.value = '10';
    this.validateInputs();
  }

  /**
   * 切换“生成导航图”按钮的 loading 状态
   * @param {boolean} loading 是否加载中
   */
  setButtonLoading(loading) {
    const btn = this.elements.generateBtn;
    if (!btn) return;

    if (loading) {
      if (!this._btnOriginalHTML) this._btnOriginalHTML = btn.innerHTML;
      btn.classList.add('is-loading');
      btn.innerHTML =
        '<svg class="animate-spin h-4 w-4 mr-2 text-white" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg><span class="btn__text">生成中…</span>';
    } else {
      btn.classList.remove('is-loading');
      if (this._btnOriginalHTML) {
        btn.innerHTML = this._btnOriginalHTML;
      }
    }
  }

  /**
   * 提取纯文本（防止原按钮包含图标）
   */
  textFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || '').trim();
  }
}

export default InputForm;
