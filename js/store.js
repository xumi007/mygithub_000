/* ============================================
   Store - 数据管理层 (localStorage)
   支持分类隔离：daily / study 使用独立存储池
   ============================================ */

const Store = {
    /** localStorage 键名模板 */
    STORAGE_KEY_PREFIX: 'ai-todo-board-tasks-',
    /** boardStatus 存储键名（兼容旧数据） */
    BOARD_STATUS_KEY: 'ai-todo-board-status',

    /** 内存中的任务列表（当前分类） */
    _tasks: [],

    /** 当前分类（daily / study） */
    _currentCategory: 'daily',

    /** 数据变更回调列表 */
    _listeners: [],

    // ============================================
    //  分类存储池管理
    // ============================================

    /**
     * 获取当前分类对应的 localStorage 键名
     */
    _getStorageKey() {
        return this.STORAGE_KEY_PREFIX + this._currentCategory;
    },

    /**
     * 设置当前分类并加载对应数据
     * @param {string} category 'daily' | 'study'
     */
    setCategory(category) {
        if (category === this._currentCategory) return;
        this._currentCategory = category;
        this._loadFromStorage();
        this._notify();
    },

    /**
     * 获取当前分类
     */
    getCurrentCategory() {
        return this._currentCategory;
    },

    /**
     * 从 localStorage 加载当前分类数据
     */
    _loadFromStorage() {
        const key = this._getStorageKey();
        const stored = localStorage.getItem(key);
        if (stored) {
            this._tasks = Utils.safeJSONParse(stored, []);
            this._normalizeTasks();
        } else {
            // 首次使用该分类，初始化为空数组
            this._tasks = [];
            // 仅 daily 分类首次使用时添加示例数据
            if (this._currentCategory === 'daily') {
                const sample = localStorage.getItem(this.STORAGE_KEY_PREFIX + 'daily');
                if (!sample) {
                    this._tasks = this._getSampleTasks();
                }
            }
            this._persist();
        }
    },

    /**
     * 校正任务数据字段完整性
     */
    _normalizeTasks() {
        this._tasks.forEach(t => {
            if (t.isParent === undefined) t.isParent = false;
            if (t.parentId === undefined) t.parentId = null;
            if (t.children === undefined) t.children = [];
            if (t.showSubtasks === undefined) t.showSubtasks = true;
            if (t.boardStatus === undefined) t.boardStatus = 'pending';
            if (t.category === undefined) t.category = 'daily';
            // 校正：有 children 且 children 长度 > 0 才标记为父任务
            const hasChildren = Array.isArray(t.children) && t.children.length > 0;
            if (hasChildren) {
                t.isParent = true;
            } else {
                t.isParent = false;
                t.children = [];
            }
        });
    },

    /**
     * 获取示例数据
     */
    _getSampleTasks() {
        return [
            {
                id: Utils.generateId(),
                title: '欢迎使用 AI 待办看板 🎉',
                description: '这是一个示例任务，你可以编辑、删除或拖拽它到其他列。',
                priority: 'medium',
                status: 'todo',
                tags: ['入门'],
                dueDate: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                category: 'daily'
            },
            {
                id: Utils.generateId(),
                title: '配置 AI API 密钥',
                description: '点击右上角 ⚙️ 按钮，填入你的 API 地址和密钥，开启 AI 增强功能。',
                priority: 'high',
                status: 'in-progress',
                tags: ['配置', 'AI'],
                dueDate: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                category: 'daily'
            },
            {
                id: Utils.generateId(),
                title: '尝试 AI 推荐清单',
                description: '点击 "AI 推荐" 按钮，输入今日目标，让 AI 为你生成待办清单。',
                priority: 'low',
                status: 'done',
                tags: ['探索'],
                dueDate: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                category: 'daily'
            }
        ];
    },

    /**
     * 初始化：从 localStorage 加载当前分类数据
     */
    init() {
        this._loadFromStorage();
        this._notify();
    },

    /**
     * 持久化数据到 localStorage（当前分类）
     */
    _persist() {
        try {
            const key = this._getStorageKey();
            localStorage.setItem(key, JSON.stringify(this._tasks));
        } catch (e) {
            console.error('存储失败:', e);
            alert('存储空间不足，请清理一些任务后重试。');
        }
    },

    /**
     * 通知所有监听器数据已变更
     */
    _notify() {
        this._listeners.forEach(fn => {
            try {
                fn(this._tasks);
            } catch (e) {
                console.error('监听器执行出错:', e);
            }
        });
    },

    /**
     * 注册数据变更监听器
     * @param {Function} listener
     */
    onChange(listener) {
        this._listeners.push(listener);
        // 立即通知当前状态
        listener(this._tasks);
    },

    /**
     * 移除监听器
     * @param {Function} listener
     */
    offChange(listener) {
        this._listeners = this._listeners.filter(fn => fn !== listener);
    },

    /**
     * 获取所有任务（当前分类）
     */
    getAll() {
        return [...this._tasks];
    },

    /**
     * 根据 ID 获取任务
     * @param {string} id
     */
    getById(id) {
        return this._tasks.find(t => t.id === id) || null;
    },

    /**
     * 根据状态获取任务列表
     * @param {string} status
     */
    getByStatus(status) {
        return this._tasks.filter(t => t.status === status);
    },

    /**
     * 添加任务
     * @param {Object} taskData
     */
    add(taskData) {
        const task = {
            id: Utils.generateId(),
            title: taskData.title || '',
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'todo',
            tags: taskData.tags || [],
            dueDate: taskData.dueDate || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // 层级字段
            parentId: taskData.parentId || null,
            children: taskData.children || [],
            showSubtasks: taskData.showSubtasks !== undefined ? taskData.showSubtasks : true,
            isParent: taskData.isParent || false,
            // 分栏状态字段
            boardStatus: taskData.boardStatus || 'pending',
            // 分类字段（强制使用当前分类）
            category: this._currentCategory
        };
        this._tasks.push(task);
        this._persist();
        this._notify();
        return task;
    },

    /**
     * 批量添加任务
     * @param {Array} tasksData
     */
    addMultiple(tasksData) {
        const now = new Date().toISOString();
        const newTasks = tasksData.map(data => ({
            id: Utils.generateId(),
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || 'medium',
            status: data.status || 'todo',
            tags: data.tags || [],
            dueDate: data.dueDate || '',
            createdAt: now,
            updatedAt: now,
            parentId: data.parentId || null,
            children: data.children || [],
            showSubtasks: data.showSubtasks !== undefined ? data.showSubtasks : true,
            category: this._currentCategory
        }));
        this._tasks.push(...newTasks);
        this._persist();
        this._notify();
        return newTasks;
    },

    // ============================================
    //  层级操作方法
    // ============================================

    /**
     * 获取所有父任务（没有 parentId 的任务）
     */
    getParentTasks() {
        return this._tasks.filter(t => !t.parentId);
    },

    /**
     * 获取某个父任务的所有子任务
     * @param {string} parentId
     */
    getChildren(parentId) {
        return this._tasks.filter(t => t.parentId === parentId);
    },

    /**
     * 将多个任务打包为子任务归入父任务
     * @param {string} parentId 父任务 ID
     * @param {string[]} childIds 子任务 ID 数组
     */
    packAsChildren(parentId, childIds) {
        const parent = this.getById(parentId);
        if (!parent) return false;

        childIds.forEach(childId => {
            const child = this.getById(childId);
            if (child && child.id !== parentId) {
                child.parentId = parentId;
                child.updatedAt = new Date().toISOString();
                // 同步父任务状态
                if (parent.children.indexOf(childId) === -1) {
                    parent.children.push(childId);
                }
            }
        });
        // 标记为真正的父任务
        parent.isParent = true;
        parent.updatedAt = new Date().toISOString();
        this._persist();
        this._notify();
        return true;
    },

    /**
     * 从父任务中解绑子任务
     * @param {string} childId
     */
    unbindChild(childId) {
        const child = this.getById(childId);
        if (!child || !child.parentId) return false;

        const parent = this.getById(child.parentId);
        if (parent) {
            parent.children = parent.children.filter(id => id !== childId);
            parent.updatedAt = new Date().toISOString();
        }

        child.parentId = null;
        child.updatedAt = new Date().toISOString();
        this._persist();
        this._notify();
        return true;
    },

    /**
     * 递归删除父任务及其所有未解绑的子任务
     * 规则：
     *   - 遍历父任务的 children 数组
     *   - 对每个 childId，检查该子任务是否仍指向该父任务（child.parentId === parentId）
     *   - 如果是（未解绑），则一并删除该子任务
     *   - 如果已解绑（child.parentId === null 或指向其他父任务），则跳过
     *   - 最后删除父任务自身
     * @param {string} parentId 父任务 ID
     */
    removeParentRecursively(parentId) {
        const parent = this.getById(parentId);
        if (!parent) return false;

        // 收集需要删除的子任务 ID（仅删除仍指向该父任务的子任务）
        const childIdsToRemove = [];
        (parent.children || []).forEach(childId => {
            const child = this.getById(childId);
            if (child && child.parentId === parentId) {
                childIdsToRemove.push(childId);
            }
            // 如果 child.parentId !== parentId，说明已解绑，跳过
        });

        // 从 _tasks 中删除这些子任务（从后往前删避免索引偏移）
        if (childIdsToRemove.length > 0) {
            const removeSet = new Set(childIdsToRemove);
            for (let i = this._tasks.length - 1; i >= 0; i--) {
                if (removeSet.has(this._tasks[i].id)) {
                    this._tasks.splice(i, 1);
                }
            }
        }

        // 删除父任务自身
        const parentIndex = this._tasks.findIndex(t => t.id === parentId);
        if (parentIndex !== -1) {
            this._tasks.splice(parentIndex, 1);
        }

        this._persist();
        this._notify();
        return true;
    },

    /**
     * 切换父任务的子任务展开/折叠
     * @param {string} parentId
     */
    toggleSubtasks(parentId) {
        const parent = this.getById(parentId);
        if (!parent) return;
        parent.showSubtasks = !parent.showSubtasks;
        parent.updatedAt = new Date().toISOString();
        this._persist();
        this._notify();
    },

    /**
     * 切换所有子任务标签的全局展开/折叠
     * @param {string} parentId
     */
    toggleAllSubtasksVisibility(parentId) {
        const parent = this.getById(parentId);
        if (!parent) return;
        parent.showSubtasks = !parent.showSubtasks;
        parent.updatedAt = new Date().toISOString();
        this._persist();
        this._notify();
    },

    /**
     * 获取某个父任务在父任务列表中的索引
     * @param {string} parentId
     */
    getParentIndex(parentId) {
        const parents = this.getParentTasks().filter(t => t.status === this.getById(parentId)?.status);
        return parents.findIndex(t => t.id === parentId);
    },

    /**
     * 获取上一个/下一个父任务
     * @param {string} parentId
     * @param {number} direction -1 上一个, 1 下一个
     */
    navigateParent(parentId, direction) {
        const parent = this.getById(parentId);
        if (!parent) return null;
        const parents = this.getParentTasks().filter(t => t.status === parent.status);
        const currentIndex = parents.findIndex(t => t.id === parentId);
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= parents.length) return null;
        return parents[newIndex];
    },

    /**
     * 更新任务
     * @param {string} id
     * @param {Object} updates
     */
    update(id, updates) {
        const index = this._tasks.findIndex(t => t.id === id);
        if (index === -1) return null;

        this._tasks[index] = {
            ...this._tasks[index],
            ...updates,
            id: this._tasks[index].id, // 防止 ID 被覆盖
            createdAt: this._tasks[index].createdAt, // 保留创建时间
            updatedAt: new Date().toISOString()
        };
        this._persist();
        this._notify();
        return this._tasks[index];
    },

    /**
     * 删除任务（普通删除，仅删除自身）
     * @param {string} id
     */
    delete(id) {
        const index = this._tasks.findIndex(t => t.id === id);
        if (index === -1) return false;
        this._tasks.splice(index, 1);
        this._persist();
        this._notify();
        return true;
    },

    /**
     * 移动任务到新状态（用于拖拽）
     * @param {string} id
     * @param {string} newStatus
     * @param {number} newIndex 目标位置索引
     */
    move(id, newStatus, newIndex) {
        const task = this.getById(id);
        if (!task) return false;

        // 从原位置移除
        const oldIndex = this._tasks.findIndex(t => t.id === id);
        this._tasks.splice(oldIndex, 1);

        // 更新状态
        task.status = newStatus;
        task.updatedAt = new Date().toISOString();

        // 插入到新位置
        // 找到目标状态列的任务范围
        const targetTasks = this._tasks.filter(t => t.status === newStatus);
        let insertIndex;
        if (newIndex >= targetTasks.length) {
            // 追加到末尾
            insertIndex = this._tasks.length;
        } else {
            // 找到目标位置的任务在原数组中的索引
            const targetTask = targetTasks[newIndex];
            insertIndex = this._tasks.indexOf(targetTask);
        }
        this._tasks.splice(insertIndex, 0, task);

        this._persist();
        this._notify();
        return true;
    },

    /**
     * 重新排序（同列内拖拽）
     * @param {string} id
     * @param {number} newIndex
     */
    reorder(id, newIndex) {
        const task = this.getById(id);
        if (!task) return false;

        const oldIndex = this._tasks.findIndex(t => t.id === id);
        this._tasks.splice(oldIndex, 1);

        // 计算在目标状态列中的插入位置
        const sameStatusTasks = this._tasks.filter(t => t.status === task.status);
        let insertIndex;
        if (newIndex >= sameStatusTasks.length) {
            insertIndex = this._tasks.length;
        } else {
            const targetTask = sameStatusTasks[newIndex];
            insertIndex = this._tasks.indexOf(targetTask);
        }
        this._tasks.splice(insertIndex, 0, task);

        this._persist();
        this._notify();
        return true;
    },

    /**
     * 清空所有任务（带确认）
     */
    clearAll() {
        if (this._tasks.length === 0) return;
        if (confirm('确定要清空所有任务吗？此操作不可撤销！')) {
            this._tasks = [];
            this._persist();
            this._notify();
        }
    },

    /**
     * 获取任务总数
     */
    getCount() {
        return this._tasks.length;
    },

    /**
     * 获取各状态任务数量
     */
    getStatusCounts() {
        return {
            todo: this._tasks.filter(t => t.status === 'todo').length,
            'in-progress': this._tasks.filter(t => t.status === 'in-progress').length,
            done: this._tasks.filter(t => t.status === 'done').length
        };
    },

    // ============================================
    //  分栏状态操作方法（boardStatus）
    // ============================================

    /**
     * 状态值映射：boardStatus → status
     */
    _boardStatusMap: {
        'pending': 'todo',
        'ongoing': 'in-progress',
        'finished': 'done'
    },

    /**
     * 反向映射：status → boardStatus
     */
    _statusToBoardMap: {
        'todo': 'pending',
        'in-progress': 'ongoing',
        'done': 'finished'
    },

    /**
     * 更新父任务状态，容器内所有子任务同步更新一致状态
     * @param {string} parentId 父任务 ID
     * @param {string} boardStatus 目标状态 pending/ongoing/finished
     */
    setParentStatus(parentId, boardStatus) {
        const parent = this.getById(parentId);
        if (!parent) return false;

        const newStatus = this._boardStatusMap[boardStatus] || 'todo';
        const now = new Date().toISOString();

        // 更新父任务
        parent.boardStatus = boardStatus;
        parent.status = newStatus;
        parent.updatedAt = now;

        // 同步更新所有子任务
        const children = this.getChildren(parentId);
        children.forEach(child => {
            child.boardStatus = boardStatus;
            child.status = newStatus;
            child.updatedAt = now;
        });

        this._persist();
        this._notify();
        return true;
    },

    /**
     * 仅修改当前子任务状态，子任务离开父卡片就解绑父子关系
     * @param {string} childId 子任务 ID
     * @param {string} boardStatus 目标状态 pending/ongoing/finished
     */
    setSingleChildStatus(childId, boardStatus) {
        const child = this.getById(childId);
        if (!child || !child.parentId) return false;

        const newStatus = this._boardStatusMap[boardStatus] || 'todo';
        const now = new Date().toISOString();

        // 从父任务中解绑
        const parent = this.getById(child.parentId);
        if (parent) {
            parent.children = parent.children.filter(id => id !== childId);
            parent.updatedAt = now;
        }

        // 更新子任务状态并解绑
        child.boardStatus = boardStatus;
        child.status = newStatus;
        child.parentId = null;
        child.updatedAt = now;

        this._persist();
        this._notify();
        return true;
    }
};
