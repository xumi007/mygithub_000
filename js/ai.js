/* ============================================
   AI - AI 功能模块
   职责：API 调用、三大 AI 功能、错误处理、防抖
   ============================================ */

const AI = {
    /** AI 配置 */
    _config: {
        endpoint: '',
        apiKey: '',
        model: 'gpt-3.5-turbo'
    },

    /** 配置存储键名 */
    CONFIG_KEY: 'ai-todo-board-ai-config',

    /** 请求防抖：每个功能独立计时器 */
    _debounceTimers: {
        polish: null,
        priority: null,
        recommend: null,
        organize: null
    },

    /** 请求防抖延迟（毫秒） */
    DEBOUNCE_DELAY: 500,

    /**
     * 初始化
     */
    init() {
        this._loadConfig();
        this._bindEvents();
    },

    /**
     * 加载配置
     */
    _loadConfig() {
        const stored = localStorage.getItem(this.CONFIG_KEY);
        if (stored) {
            const config = Utils.safeJSONParse(stored, {});
            this._config = { ...this._config, ...config };
        }
    },

    /**
     * 保存配置
     */
    _saveConfig() {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this._config));
    },

    /**
     * 获取配置
     */
    getConfig() {
        return { ...this._config };
    },

    /**
     * 更新配置
     */
    updateConfig(config) {
        this._config = { ...this._config, ...config };
        this._saveConfig();
    },

    /**
     * 检查 AI 是否已配置
     */
    isConfigured() {
        return !!(this._config.endpoint && this._config.apiKey);
    },

    // ============================================
    //  API 调用
    // ============================================

    /**
     * 调用 AI API（兼容 OpenAI 格式）
     * @param {Array} messages [{role, content}]
     * @param {number} timeout 超时时间（毫秒）
     * @returns {Object} API 响应
     */
    async callAPI(messages, timeout = 30000) {
        if (!this.isConfigured()) {
            throw new AIError('AI_CONFIG_MISSING', '请先在 ⚙️ 设置中配置 API 地址和密钥');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(this._config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._config.apiKey}`
                },
                body: JSON.stringify({
                    model: this._config.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2000
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new AIError('AI_AUTH_ERROR', 'API 密钥无效或权限不足，请检查 ⚙️ 设置中的密钥');
                } else if (response.status === 429) {
                    throw new AIError('AI_RATE_LIMIT', 'API 请求过于频繁，请稍后重试');
                } else if (response.status >= 500) {
                    throw new AIError('AI_SERVER_ERROR', 'AI 服务暂时不可用，请稍后重试');
                } else {
                    throw new AIError('AI_API_ERROR', `API 返回错误 (${response.status})，请检查配置`);
                }
            }

            const data = await response.json();
            return data;

        } catch (err) {
            clearTimeout(timeoutId);

            if (err instanceof AIError) throw err;

            if (err.name === 'AbortError') {
                throw new AIError('AI_TIMEOUT', 'AI 请求超时，请检查网络连接或稍后重试');
            }

            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new AIError('AI_NETWORK_ERROR', '网络连接失败，请检查 API 地址是否正确');
            }

            throw new AIError('AI_UNKNOWN_ERROR', `AI 请求失败：${err.message}`);
        }
    },

    /**
     * 从 API 响应中提取文本内容
     * @param {Object} response
     */
    _extractContent(response) {
        try {
            return response.choices[0].message.content.trim();
        } catch (err) {
            throw new AIError('AI_PARSE_ERROR', '无法解析 AI 响应格式');
        }
    },

    /**
     * 从 AI 响应中解析 JSON
     * @param {Object} response
     */
    _parseJSON(response) {
        const content = this._extractContent(response);

        // 尝试直接解析
        try {
            return JSON.parse(content);
        } catch {
            // 尝试从 markdown 代码块中提取 JSON
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1].trim());
                } catch {
                    throw new AIError('AI_PARSE_ERROR', 'AI 返回格式异常，请重试');
                }
            }
            throw new AIError('AI_PARSE_ERROR', 'AI 返回格式异常，请重试');
        }
    },

    // ============================================
    //  防抖工具
    // ============================================

    /**
     * 防抖执行 AI 请求
     * @param {string} type 功能类型（polish/priority/recommend）
     * @param {Function} fn 要执行的异步函数
     */
    _debouncedCall(type, fn) {
        return new Promise((resolve, reject) => {
            // 清除该类型的旧计时器
            if (this._debounceTimers[type]) {
                clearTimeout(this._debounceTimers[type]);
            }

            this._debounceTimers[type] = setTimeout(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            }, this.DEBOUNCE_DELAY);
        });
    },

    // ============================================
    //  功能一：任务文案润色 + 子任务拆分
    // ============================================

    /**
     * 润色任务文案并拆分子任务
     * @param {string} title 任务标题
     * @param {string} description 任务描述
     * @returns {Promise<{polishedTitle, polishedDescription, subtasks}>}
     */
    async polishTask(title, description) {
        return this._debouncedCall('polish', async () => {
            const { system, user } = PromptTemplates.polish(title, description);
            const response = await this.callAPI([
                { role: 'system', content: system },
                { role: 'user', content: user }
            ]);
            return this._parseJSON(response);
        });
    },

    // ============================================
    //  功能二：自动评估任务优先级
    // ============================================

    /**
     * 评估任务优先级
     * @param {Object} task 任务对象
     * @returns {Promise<{priority, reason}>}
     */
    async evaluatePriority(task) {
        return this._debouncedCall('priority', async () => {
            const { system, user } = PromptTemplates.evaluatePriority(task);
            const response = await this.callAPI([
                { role: 'system', content: system },
                { role: 'user', content: user }
            ]);
            return this._parseJSON(response);
        });
    },

    // ============================================
    //  功能三：根据目标推荐待办清单
    // ============================================

    /**
     * 根据目标推荐待办清单（扁平结构）
     * @param {string} goal 用户输入的目标
     * @returns {Promise<{tasks: Array, summary: string}>}
     */
    async recommendTasks(goal) {
        return this._debouncedCall('recommend', async () => {
            const { system, user } = PromptTemplates.recommendTasks(goal);
            const response = await this.callAPI([
                { role: 'system', content: system },
                { role: 'user', content: user }
            ], 45000); // 推荐功能给更长超时
            return this._parseJSON(response);
        });
    },

    /**
     * 根据目标推荐待办清单（父子结构，自动堆叠）
     * @param {string} goal 用户输入的目标
     * @param {string} parentTitle 父任务标题
     * @returns {Promise<{parent: Object, children: Array, summary: string}>}
     */
    async recommendTasksWithStack(goal, parentTitle) {
        return this._debouncedCall('recommend', async () => {
            const { system, user } = PromptTemplates.recommendTasksWithStack(goal, parentTitle);
            const response = await this.callAPI([
                { role: 'system', content: system },
                { role: 'user', content: user }
            ], 45000);
            return this._parseJSON(response);
        });
    },

    /**
     * AI 一键归集整理：分析选中任务，自动合并同主题任务生成父任务
     * @param {Array} tasks 选中的任务列表 [{title, description, tags, priority}]
     * @param {string} customParentTitle 用户自定义父任务标题（可选）
     * @returns {Promise<{groups: Array, summary: string}>}
     */
    async organizeTasks(tasks, customParentTitle) {
        return this._debouncedCall('organize', async () => {
            const { system, user } = PromptTemplates.organizeTasks(tasks, customParentTitle);
            const response = await this.callAPI([
                { role: 'system', content: system },
                { role: 'user', content: user }
            ], 45000);
            return this._parseJSON(response);
        });
    },

    // ============================================
    //  事件绑定
    // ============================================

    /**
     * 绑定 AI 相关按钮事件
     */
    _bindEvents() {
        // AI 设置按钮 → 打开设置弹窗
        document.getElementById('btnSettings').addEventListener('click', () => {
            ModalSettings.open();
        });

        // AI 润色按钮 → 润色当前任务文案
        document.getElementById('btnPolish').addEventListener('click', async () => {
            await this._handlePolish();
        });

        // AI 自动优先级按钮 → 评估当前任务优先级
        document.getElementById('btnAutoPriority').addEventListener('click', async () => {
            await this._handleAutoPriority();
        });

        // AI 推荐按钮 → 打开推荐弹窗
        document.getElementById('btnAiRecommend').addEventListener('click', () => {
            ModalAiRecommend.open();
        });
    },

    // ============================================
    //  交互处理
    // ============================================

    /**
     * 处理 AI 润色
     */
    async _handlePolish() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) {
            alert('请先输入任务标题，再进行 AI 润色');
            return;
        }

        const description = document.getElementById('taskDescription').value.trim();

        // 显示加载状态
        const btnPolish = document.getElementById('btnPolish');
        const originalText = btnPolish.textContent;
        btnPolish.textContent = '⏳';
        btnPolish.disabled = true;

        try {
            const result = await this.polishTask(title, description);

            // 回填润色结果
            if (result.polishedTitle) {
                document.getElementById('taskTitle').value = result.polishedTitle;
            }
            if (result.polishedDescription) {
                document.getElementById('taskDescription').value = result.polishedDescription;
            }

            // 如果有子任务，提示用户
            if (result.subtasks && result.subtasks.length > 0) {
                const subtaskList = result.subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n');
                const confirmAdd = confirm(
                    `AI 建议将任务拆分为以下子任务：\n\n${subtaskList}\n\n是否将这些子任务添加到看板？`
                );
                if (confirmAdd) {
                    const tasksToAdd = result.subtasks.map(title => ({
                        title: title,
                        description: `由「${result.polishedTitle || title}」拆分的子任务`,
                        priority: 'medium',
                        status: 'todo',
                        tags: ['子任务']
                    }));
                    Store.addMultiple(tasksToAdd);
                    alert(`✅ 已添加 ${tasksToAdd.length} 个子任务到「待开始」列`);
                }
            } else {
                alert('✅ AI 润色完成！');
            }
        } catch (err) {
            if (err instanceof AIError) {
                alert(`❌ ${err.message}`);
            } else {
                alert('❌ AI 润色失败，请稍后重试');
                console.error('Polish error:', err);
            }
        } finally {
            btnPolish.textContent = originalText;
            btnPolish.disabled = false;
        }
    },

    /**
     * 处理 AI 自动优先级评估
     */
    async _handleAutoPriority() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) {
            alert('请先输入任务标题，再进行优先级评估');
            return;
        }

        const taskData = {
            title: title,
            description: document.getElementById('taskDescription').value.trim(),
            dueDate: document.getElementById('taskDueDate').value,
            tags: document.getElementById('taskTags').value.split(',').map(t => t.trim()).filter(Boolean)
        };

        // 显示加载状态
        const btnPriority = document.getElementById('btnAutoPriority');
        const originalText = btnPriority.textContent;
        btnPriority.textContent = '⏳';
        btnPriority.disabled = true;

        try {
            const result = await this.evaluatePriority(taskData);

            if (result.priority) {
                document.getElementById('taskPriority').value = result.priority;
                const reason = result.reason ? `\n\n评估理由：${result.reason}` : '';
                alert(`✅ AI 评估完成！\n\n推荐优先级：${Utils.getPriorityLabel(result.priority)}${reason}`);
            }
        } catch (err) {
            if (err instanceof AIError) {
                alert(`❌ ${err.message}`);
            } else {
                alert('❌ 优先级评估失败，请稍后重试');
                console.error('Priority error:', err);
            }
        } finally {
            btnPriority.textContent = originalText;
            btnPriority.disabled = false;
        }
    }
};

/**
 * AI 自定义错误类
 */
class AIError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'AIError';
        this.code = code;
    }
}
