/* ============================================
   ModalCategoryConfirm - AI 分类预判确认弹窗
   职责：展示 AI 预判的分类，让用户确认/手动切换后，再写入对应分类的存储池
   ============================================ */

const ModalCategoryConfirm = {
    /** DOM 引用 */
    modal: null,
    overlay: null,
    btnClose: null,
    btnCancel: null,
    btnAccept: null,
    switchBtns: null,
    loadingArea: null,
    contentArea: null,
    predictIcon: null,
    predictValue: null,
    confidenceFill: null,
    confidenceText: null,
    warningArea: null,
    summaryArea: null,

    /** 回调：用户确认分类后执行 (category, result) => {} */
    _onConfirm: null,

    /** 回调：用户取消时执行 () => {} */
    _onCancel: null,

    /** 当前预判数据缓存 */
    _predictedCategory: null,
    _confidence: 0,
    _result: null,

    /**
     * 初始化
     */
    init() {
        this.modal = document.getElementById('modalCategoryConfirm');
        this.overlay = document.getElementById('overlay');
        this.btnClose = document.getElementById('btnCloseCategoryConfirm');
        this.btnCancel = document.getElementById('btnCancelCategoryConfirm');
        this.btnAccept = document.getElementById('btnAcceptCategory');
        this.switchBtns = document.querySelectorAll('.category-switch-btn');
        this.loadingArea = document.getElementById('categoryConfirmLoading');
        this.contentArea = document.getElementById('categoryConfirmContent');
        this.predictIcon = document.getElementById('categoryPredictIcon');
        this.predictValue = document.getElementById('categoryPredictValue');
        this.confidenceFill = document.getElementById('confidenceFill');
        this.confidenceText = document.getElementById('confidenceText');
        this.warningArea = document.getElementById('categoryPredictWarning');
        this.summaryArea = document.getElementById('categoryPredictSummary');

        this._bindEvents();
    },

    /**
     * 绑定事件
     */
    _bindEvents() {
        this.btnClose.addEventListener('click', () => this._handleCancel());
        this.btnCancel.addEventListener('click', () => this._handleCancel());
        this.btnAccept.addEventListener('click', () => this._handleAccept());

        // 手动切换分类按钮
        this.switchBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this._switchToCategory(category);
            });
        });

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this._handleCancel();
            }
        });
    },

    /**
     * 打开分类确认弹窗
     * @param {Object} result AI 返回的完整结果（含 predictedCategory, confidence, summary, tasks/children）
     * @param {Function} onConfirm 用户确认后的回调 (category) => {}
     * @param {Function} onCancel 用户取消时的回调 () => {}
     */
    open(result, onConfirm, onCancel) {
        this._onConfirm = onConfirm;
        this._onCancel = onCancel;
        this._result = result;

        // 提取预判分类和置信度
        const predictedCategory = result.predictedCategory || 'daily';
        const confidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
        const summary = result.summary || '';

        this._predictedCategory = predictedCategory;
        this._confidence = confidence;

        // 更新 UI
        this._updateUI(predictedCategory, confidence, summary);

        // 显示弹窗
        this.modal.classList.remove('hidden');
        this.overlay.classList.remove('hidden');
    },

    /**
     * 关闭弹窗
     */
    close() {
        this.modal.classList.add('hidden');
        this.overlay.classList.add('hidden');
        this._onConfirm = null;
        this._onCancel = null;
        this._result = null;
    },

    /**
     * 更新 UI 展示
     * @param {string} category daily | study
     * @param {number} confidence 0~1
     * @param {string} summary 摘要
     */
    _updateUI(category, confidence, summary) {
        // 图标和文字
        if (category === 'study') {
            this.predictIcon.textContent = '📚';
            this.predictValue.textContent = '学习计划';
        } else {
            this.predictIcon.textContent = '📋';
            this.predictValue.textContent = '日常日程';
        }

        // 置信度进度条
        const percent = Math.round(confidence * 100);
        this.confidenceFill.style.width = percent + '%';
        this.confidenceText.textContent = `置信度 ${percent}%`;

        // 置信度颜色：高置信度用 primary，低置信度用 warning
        if (confidence >= 0.7) {
            this.confidenceFill.style.background = 'var(--color-primary)';
        } else {
            this.confidenceFill.style.background = 'var(--color-warning)';
        }

        // 低置信度警告
        if (confidence < 0.7) {
            this.warningArea.classList.remove('hidden');
        } else {
            this.warningArea.classList.add('hidden');
        }

        // 摘要
        this.summaryArea.textContent = summary || '（无摘要）';
    },

    /**
     * 手动切换到指定分类
     * @param {string} category daily | study
     */
    _switchToCategory(category) {
        this._predictedCategory = category;
        // 手动切换时置信度设为 1（用户已确认）
        this._updateUI(category, 1, this._result.summary || '');
        // 隐藏警告
        this.warningArea.classList.add('hidden');
    },

    /**
     * 处理采纳/确认
     */
    _handleAccept() {
        const category = this._predictedCategory || 'daily';
        this.close();
        if (this._onConfirm) {
            this._onConfirm(category, this._result);
        }
    },

    /**
     * 处理取消
     */
    _handleCancel() {
        this.close();
        if (this._onCancel) {
            this._onCancel();
        }
    }
};
