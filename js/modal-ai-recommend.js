/* ============================================
   ModalAiRecommend - AI 推荐待办清单弹窗
   职责：AI 推荐弹窗交互、父子结构解析与自动堆叠
   ============================================ */

const ModalAiRecommend = {
    /** DOM 引用 */
    modal: null,
    overlay: null,
    btnClose: null,
    btnCancel: null,
    btnGenerate: null,
    inputGoal: null,
    resultArea: null,
    loadingArea: null,
    errorArea: null,
    chkAutoStack: null,
    parentTitleGroup: null,
    inputParentTitle: null,

    /** 推荐结果缓存 */
    _lastResult: null,

    /**
     * 初始化
     */
    init() {
        this.modal = document.getElementById('modalAiRecommend');
        this.overlay = document.getElementById('overlay');
        this.btnClose = document.getElementById('btnCloseAiRecommend');
        this.btnCancel = document.getElementById('btnCancelAiRecommend');
        this.btnGenerate = document.getElementById('btnGenerateTasks');
        this.inputGoal = document.getElementById('aiGoalInput');
        this.resultArea = document.getElementById('aiRecommendResult');
        this.loadingArea = document.getElementById('aiRecommendLoading');
        this.errorArea = document.getElementById('aiRecommendError');
        this.chkAutoStack = document.getElementById('chkAutoStack');
        this.parentTitleGroup = document.getElementById('aiParentTitleGroup');
        this.inputParentTitle = document.getElementById('aiParentTitle');

        this._bindEvents();
    },

    /**
     * 绑定事件
     */
    _bindEvents() {
        this.btnClose.addEventListener('click', () => this.close());
        this.btnCancel.addEventListener('click', () => this.close());
        this.btnGenerate.addEventListener('click', () => this._handleGenerate());

        // 点击遮罩层关闭
        this.overlay.addEventListener('click', (e) => {
            if (!this.modal.classList.contains('hidden')) {
                this.close();
            }
        });

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });

        // Ctrl+Enter 快捷生成
        this.inputGoal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this._handleGenerate();
            }
        });

        // 复选框切换 → 显示/隐藏父标题输入框
        this.chkAutoStack.addEventListener('change', () => {
            if (this.chkAutoStack.checked) {
                this.parentTitleGroup.classList.remove('hidden');
                // 如果父标题为空，自动填入目标内容
                if (!this.inputParentTitle.value.trim()) {
                    this.inputParentTitle.value = this.inputGoal.value.trim();
                }
            } else {
                this.parentTitleGroup.classList.add('hidden');
            }
        });

        // 当目标输入变化时，如果父标题为空或与之前自动填入的一致，同步更新
        this.inputGoal.addEventListener('input', () => {
            if (this.chkAutoStack.checked && this.parentTitleGroup.classList.contains('hidden') === false) {
                // 仅在父标题为空或与目标相同时自动同步
                const currentParent = this.inputParentTitle.value.trim();
                if (!currentParent || currentParent === this.inputGoal.value.trim()) {
                    this.inputParentTitle.value = this.inputGoal.value.trim();
                }
            }
        });
    },

    /**
     * 打开推荐弹窗
     */
    open() {
        this.inputGoal.value = '';
        this.resultArea.classList.add('hidden');
        this.loadingArea.classList.add('hidden');
        this.errorArea.classList.add('hidden');
        this._lastResult = null;
        this.chkAutoStack.checked = false;
        this.parentTitleGroup.classList.add('hidden');
        this.inputParentTitle.value = '';

        this.modal.classList.remove('hidden');
        this.overlay.classList.remove('hidden');
        this.inputGoal.focus();
    },

    /**
     * 关闭推荐弹窗
     */
    close() {
        this.modal.classList.add('hidden');
        this.overlay.classList.add('hidden');
    },

    /**
     * 处理生成推荐
     */
    async _handleGenerate() {
        const goal = this.inputGoal.value.trim();
        if (!goal) {
            alert('请输入您的目标或需求');
            this.inputGoal.focus();
            return;
        }

        // 检查 AI 配置
        if (!AI.isConfigured()) {
            alert('请先在 ⚙️ 设置中配置 API 地址和密钥');
            return;
        }

        // 显示加载状态
        this.resultArea.classList.add('hidden');
        this.errorArea.classList.add('hidden');
        this.loadingArea.classList.remove('hidden');
        this.btnGenerate.disabled = true;
        this.btnGenerate.textContent = '⏳ 生成中...';

        try {
            let result;

            if (this.chkAutoStack.checked) {
                // 父子结构模式：全程等待 AI 返回完整 JSON（含 parentTitle、children、predictedCategory、confidence）
                const parentTitle = this.inputParentTitle.value.trim() || goal;
                result = await AI.recommendTasksWithStack(goal, parentTitle);
                this._lastResult = { ...result, _isStack: true, _parentTitle: parentTitle };
            } else {
                // 扁平结构模式
                result = await AI.recommendTasks(goal);
                this._lastResult = result;
            }

            // 关闭加载状态（AI 已返回完整 JSON）
            this.loadingArea.classList.add('hidden');

            // 容错检查：JSON 格式异常或 children/tasks 字段缺失 → 跳过分类弹窗，沿用老逻辑
            const hasValidData = this.chkAutoStack.checked
                ? (result && result.parent && Array.isArray(result.children) && result.children.length > 0)
                : (result && Array.isArray(result.tasks) && result.tasks.length > 0);

            if (!hasValidData) {
                // 数据不完整，降级为旧流程：直接渲染结果到当前 Tab
                this._renderResult(result);
                this.resultArea.classList.remove('hidden');
                this.btnGenerate.disabled = false;
                this.btnGenerate.textContent = '🤖 AI 生成';
                return;
            }

            // 拿到完整合法 JSON 后，检查是否有 predictedCategory
            if (result.predictedCategory) {
                // 新流程：弹出分类确认弹窗（仅做分区选择，不修改子任务结构）
                // 弹窗期间 btnGenerate 保持禁用，防止重复请求
                this._showCategoryConfirm(result);
                // 注意：_showCategoryConfirm 是异步弹窗流程，btnGenerate 的恢复由弹窗回调控制
            } else {
                // AI 未返回分类预判（旧模型/降级），直接渲染结果到当前 Tab
                this._renderResult(result);
                this.resultArea.classList.remove('hidden');
                this.btnGenerate.disabled = false;
                this.btnGenerate.textContent = '🤖 AI 生成';
            }
        } catch (err) {
            this.loadingArea.classList.add('hidden');
            this.errorArea.classList.remove('hidden');

            if (err instanceof AIError) {
                this.errorArea.textContent = `❌ ${err.message}`;
            } else {
                this.errorArea.textContent = '❌ 生成失败，请稍后重试';
                console.error('Recommend error:', err);
            }
            this.btnGenerate.disabled = false;
            this.btnGenerate.textContent = '🤖 AI 生成';
        }
    },

    /**
     * 展示 AI 分类预判确认弹窗
     * 弹窗仅用来敲定最终日常/学习分区，children 子任务原样保留，不对子任务结构做修改
     * 弹窗期间禁用 AI 生成按钮防止重复请求
     * @param {Object} result AI 返回结果
     */
    _showCategoryConfirm(result) {
        ModalCategoryConfirm.open(
            result,
            // onConfirm: 用户确认分类后执行
            (category, confirmedResult) => {
                // 1. 切换到目标分类存储池（确保任务写入正确的分区）
                Store.setCategory(category);

                // 2. 写入任务（children 子任务原样保留，不做结构修改）
                if (confirmedResult._isStack) {
                    this._addStackTasksDirect(confirmedResult);
                } else {
                    this._addAllTasksDirect(confirmedResult);
                }

                // 3. 切换 Tab 高亮到目标分类
                this._switchTabTo(category);

                // 4. 恢复 AI 生成按钮
                this.btnGenerate.disabled = false;
                this.btnGenerate.textContent = '🤖 AI 生成';

                // 5. 关闭推荐弹窗
                this.close();
            },
            // onCancel: 用户取消
            () => {
                // 用户取消，回到推荐弹窗继续编辑
                this.resultArea.classList.remove('hidden');
                this._renderResult(result);
                this.btnGenerate.disabled = false;
                this.btnGenerate.textContent = '🤖 AI 生成';
            }
        );
    },

    /**
     * 切换 Tab 高亮到指定分类
     * 通过 Store.setCategory 触发完整切换流程（更新高亮 + 切换存储池 + 重新渲染）
     * @param {string} category daily | study
     */
    _switchTabTo(category) {
        const tabs = document.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        // 同步 Board 的当前分类
        Board._currentCategory = category;
        // 通知 Store 切换分类存储池（会触发重新加载 + notify + 重新渲染）
        Store.setCategory(category);
    },

    /**
     * 直接添加所有任务（扁平结构）- 用于分类确认后的写入
     * @param {Object} result
     */
    _addAllTasksDirect(result) {
        const tasks = result.tasks || [];
        if (tasks.length === 0) {
            alert('没有任务可添加');
            return;
        }

        const taskObjects = tasks.map(t => ({
            title: t.title,
            description: t.description || '',
            priority: t.priority || 'medium',
            status: 'todo',
            tags: t.tags || [],
            category: Store.getCurrentCategory()
        }));

        Store.addMultiple(taskObjects);
        alert(`✅ 已添加 ${taskObjects.length} 个任务到「${Store.getCurrentCategory() === 'daily' ? '日常日程' : '学习计划'}」板块的「待开始」列`);
    },

    /**
     * 直接添加父子结构任务 - 用于分类确认后的写入
     * @param {Object} result
     */
    _addStackTasksDirect(result) {
        const parent = result.parent || {};
        const children = result.children || [];

        if (children.length === 0) {
            alert('没有子任务可添加');
            return;
        }

        try {
            // 1. 创建父任务
            const parentTask = Store.add({
                title: parent.title || result._parentTitle || '父任务',
                description: parent.description || '',
                priority: parent.priority || 'medium',
                status: 'todo',
                tags: parent.tags || [],
                isParent: true
            });

            // 2. 批量创建子任务并收集 ID
            const childIds = [];
            children.forEach(child => {
                const childTask = Store.add({
                    title: child.title,
                    description: child.description || '',
                    priority: child.priority || 'medium',
                    status: 'todo',
                    tags: child.tags || [],
                    parentId: parentTask.id
                });
                childIds.push(childTask.id);
            });

            // 3. 打包为子任务
            Store.packAsChildren(parentTask.id, childIds);

            // 4. 启用卡牌堆叠模式
            Board._saveStackMode(parentTask.id, true);

            const categoryLabel = Store.getCurrentCategory() === 'daily' ? '日常日程' : '学习计划';
            alert(`✅ 已添加父任务「${parentTask.title}」及 ${childIds.length} 个子任务到「${categoryLabel}」板块，子任务已自动卡牌堆叠`);
        } catch (err) {
            console.error('添加堆叠任务失败:', err);
            // 降级处理
            try {
                const flatTasks = children.map(child => ({
                    title: child.title,
                    description: child.description || '',
                    priority: child.priority || 'medium',
                    status: 'todo',
                    tags: child.tags || []
                }));
                Store.addMultiple(flatTasks);
                alert(`⚠️ 父子结构添加失败，已降级为普通任务添加 ${flatTasks.length} 项`);
            } catch (fallbackErr) {
                alert('❌ 添加任务失败，请重试');
                console.error('降级添加也失败:', fallbackErr);
            }
        }
    },

    /**
     * 渲染推荐结果
     * @param {Object} result
     */
    _renderResult(result) {
        // 判断是否为父子结构
        const isStack = result && result.parent && Array.isArray(result.children);

        if (isStack) {
            this._renderStackResult(result);
        } else {
            this._renderFlatResult(result);
        }
    },

    /**
     * 渲染扁平结构结果（原有逻辑）
     * @param {Object} result
     */
    _renderFlatResult(result) {
        if (!result.tasks || result.tasks.length === 0) {
            this.resultArea.innerHTML = '<div class="ai-recommend-empty">AI 未生成任务，请尝试更具体地描述您的目标</div>';
            return;
        }

        let html = '';

        // 摘要
        if (result.summary) {
            html += `<div class="ai-recommend-summary">📋 ${this._escapeHtml(result.summary)}</div>`;
        }

        // 任务列表
        html += '<div class="ai-recommend-tasks">';
        result.tasks.forEach((task, index) => {
            const priorityLabel = Utils.getPriorityLabel(task.priority || 'medium');
            const tagsHtml = (task.tags || [])
                .map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`)
                .join('');

            html += `
                <div class="ai-recommend-task" data-index="${index}">
                    <div class="ai-recommend-task-header">
                        <span class="ai-recommend-task-check"></span>
                        <span class="ai-recommend-task-title">${this._escapeHtml(task.title)}</span>
                        <span class="priority-badge ${Task.getPriorityBadgeClass(task.priority || 'medium')}">${priorityLabel}</span>
                    </div>
                    ${task.description ? `<div class="ai-recommend-task-desc">${this._escapeHtml(task.description)}</div>` : ''}
                    ${tagsHtml ? `<div class="ai-recommend-task-tags">${tagsHtml}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';

        // 批量添加按钮
        html += `
            <div class="ai-recommend-actions">
                <button id="btnAddAllRecommend" class="btn btn-primary" disabled>✅ 一键添加全部（${result.tasks.length} 项）</button>
            </div>
        `;

        this.resultArea.innerHTML = html;

        // 绑定添加按钮事件
        document.getElementById('btnAddAllRecommend').addEventListener('click', () => {
            this._addAllTasks(result.tasks);
        });

        // 绑定单个任务点击选择
        this.resultArea.querySelectorAll('.ai-recommend-task').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.ai-recommend-task')) {
                    el.classList.toggle('selected');
                    this._updateAddButton(result.tasks);
                }
            });
        });
    },

    /**
     * 渲染父子结构结果
     * @param {Object} result
     */
    _renderStackResult(result) {
        const parent = result.parent || {};
        const children = result.children || [];

        if (children.length === 0) {
            this.resultArea.innerHTML = '<div class="ai-recommend-empty">AI 未生成子任务，请尝试更具体地描述您的目标</div>';
            return;
        }

        let html = '';

        // 摘要
        if (result.summary) {
            html += `<div class="ai-recommend-summary">📋 ${this._escapeHtml(result.summary)}</div>`;
        }

        // 父任务预览
        const parentPriorityLabel = Utils.getPriorityLabel(parent.priority || 'medium');
        const parentTagsHtml = (parent.tags || [])
            .map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`)
            .join('');

        html += `
            <div class="ai-recommend-stack-parent">
                <div class="ai-recommend-stack-parent-header">
                    <span class="ai-recommend-stack-parent-icon">📂</span>
                    <span class="ai-recommend-stack-parent-title">${this._escapeHtml(parent.title || '父任务')}</span>
                    <span class="priority-badge ${Task.getPriorityBadgeClass(parent.priority || 'medium')}">${parentPriorityLabel}</span>
                </div>
                ${parent.description ? `<div class="ai-recommend-stack-parent-desc">${this._escapeHtml(parent.description)}</div>` : ''}
                ${parentTagsHtml ? `<div class="ai-recommend-stack-parent-tags">${parentTagsHtml}</div>` : ''}
                <div class="ai-recommend-stack-count">📎 ${children.length} 个子任务</div>
            </div>
        `;

        // 子任务列表
        html += '<div class="ai-recommend-tasks">';
        children.forEach((child, index) => {
            const priorityLabel = Utils.getPriorityLabel(child.priority || 'medium');
            const tagsHtml = (child.tags || [])
                .map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`)
                .join('');

            html += `
                <div class="ai-recommend-task" data-index="${index}">
                    <div class="ai-recommend-task-header">
                        <span class="ai-recommend-task-check"></span>
                        <span class="ai-recommend-task-title">${this._escapeHtml(child.title)}</span>
                        <span class="priority-badge ${Task.getPriorityBadgeClass(child.priority || 'medium')}">${priorityLabel}</span>
                    </div>
                    ${child.description ? `<div class="ai-recommend-task-desc">${this._escapeHtml(child.description)}</div>` : ''}
                    ${tagsHtml ? `<div class="ai-recommend-task-tags">${tagsHtml}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';

        // 批量添加按钮
        html += `
            <div class="ai-recommend-actions">
                <button id="btnAddAllRecommend" class="btn btn-primary" disabled>✅ 一键添加全部（${children.length} 项子任务）</button>
            </div>
        `;

        this.resultArea.innerHTML = html;

        // 绑定添加按钮事件
        document.getElementById('btnAddAllRecommend').addEventListener('click', () => {
            this._addStackTasks(result);
        });

        // 绑定单个任务点击选择
        this.resultArea.querySelectorAll('.ai-recommend-task').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.ai-recommend-task')) {
                    el.classList.toggle('selected');
                    this._updateAddButton(result.children || result.tasks);
                }
            });
        });
    },

    /**
     * 添加所有推荐任务到看板（扁平结构）
     * @param {Array} tasks
     */
    _addAllTasks(tasks) {
        const selectedTasks = this.resultArea.querySelectorAll('.ai-recommend-task.selected');

        let tasksToAdd;
        if (selectedTasks.length > 0) {
            tasksToAdd = [];
            selectedTasks.forEach(el => {
                const index = parseInt(el.dataset.index);
                tasksToAdd.push(tasks[index]);
            });
        } else {
            tasksToAdd = tasks;
        }

        if (tasksToAdd.length === 0) {
            alert('请至少选择一个任务');
            return;
        }

        const taskObjects = tasksToAdd.map(t => ({
            title: t.title,
            description: t.description || '',
            priority: t.priority || 'medium',
            status: 'todo',
            tags: t.tags || [],
            category: t.category || 'daily'
        }));

        Store.addMultiple(taskObjects);
        alert(`✅ 已添加 ${taskObjects.length} 个任务到「待开始」列`);
        this.close();
    },

    /**
     * 添加父子结构任务到看板（自动堆叠）
     * @param {Object} result
     */
    _addStackTasks(result) {
        const parent = result.parent || {};
        const children = result.children || [];

        if (children.length === 0) {
            alert('没有子任务可添加');
            return;
        }

        // 检查是否有选中的子任务
        const selectedTasks = this.resultArea.querySelectorAll('.ai-recommend-task.selected');
        let childrenToAdd;
        if (selectedTasks.length > 0) {
            childrenToAdd = [];
            selectedTasks.forEach(el => {
                const index = parseInt(el.dataset.index);
                if (children[index]) {
                    childrenToAdd.push(children[index]);
                }
            });
        } else {
            childrenToAdd = children;
        }

        if (childrenToAdd.length === 0) {
            alert('请至少选择一个子任务');
            return;
        }

        try {
            // 1. 创建父任务
            const parentTask = Store.add({
                title: parent.title || result._parentTitle || '父任务',
                description: parent.description || '',
                priority: parent.priority || 'medium',
                status: 'todo',
                tags: parent.tags || [],
                isParent: true
            });

            // 2. 批量创建子任务并收集 ID
            const childIds = [];
            childrenToAdd.forEach(child => {
                const childTask = Store.add({
                    title: child.title,
                    description: child.description || '',
                    priority: child.priority || 'medium',
                    status: 'todo',
                    tags: child.tags || [],
                    parentId: parentTask.id
                });
                childIds.push(childTask.id);
            });

            // 3. 打包为子任务（设置 parentId + 更新父任务 children 数组）
            Store.packAsChildren(parentTask.id, childIds);

            // 4. 启用卡牌堆叠模式
            Board._saveStackMode(parentTask.id, true);

            alert(`✅ 已添加父任务「${parentTask.title}」及 ${childIds.length} 个子任务到「待开始」列，子任务已自动卡牌堆叠`);
        } catch (err) {
            console.error('添加堆叠任务失败:', err);
            // 降级处理：如果父子结构添加失败，尝试以扁平方式添加
            try {
                const flatTasks = childrenToAdd.map(child => ({
                    title: child.title,
                    description: child.description || '',
                    priority: child.priority || 'medium',
                    status: 'todo',
                    tags: child.tags || []
                }));
                Store.addMultiple(flatTasks);
                alert(`⚠️ 父子结构添加失败，已降级为普通任务添加 ${flatTasks.length} 项`);
            } catch (fallbackErr) {
                alert('❌ 添加任务失败，请重试');
                console.error('降级添加也失败:', fallbackErr);
            }
        }

        this.close();
    },

    /**
     * 更新添加按钮文本与状态
     */
    _updateAddButton(tasks) {
        const selectedCount = this.resultArea.querySelectorAll('.ai-recommend-task.selected').length;
        const btn = document.getElementById('btnAddAllRecommend');
        if (btn) {
            if (selectedCount > 0) {
                btn.textContent = `✅ 添加选中项（${selectedCount}/${tasks.length}）`;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.textContent = `✅ 一键添加全部（${tasks.length} 项）`;
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        }
    },

    /**
     * HTML 转义
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
