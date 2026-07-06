/* ============================================
   Task - 任务模型与表单校验
   ============================================ */

const Task = {
    /**
     * 任务状态枚举
     */
    STATUSES: {
        TODO: 'todo',
        IN_PROGRESS: 'in-progress',
        DONE: 'done'
    },

    /**
     * 优先级枚举
     */
    PRIORITIES: {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low'
    },

    /**
     * 创建任务对象
     * @param {Object} data
     */
    create(data = {}) {
        return {
            id: data.id || Utils.generateId(),
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || this.PRIORITIES.MEDIUM,
            status: data.status || this.STATUSES.TODO,
            tags: Array.isArray(data.tags) ? data.tags : [],
            dueDate: data.dueDate || '',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString()
        };
    },

    /**
     * 校验任务数据
     * @param {Object} data
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(data) {
        const errors = [];

        // 标题必填
        if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
            errors.push('任务标题不能为空');
        } else if (data.title.trim().length > 200) {
            errors.push('任务标题不能超过200个字符');
        }

        // 描述可选，但限制长度
        if (data.description && data.description.length > 2000) {
            errors.push('任务描述不能超过2000个字符');
        }

        // 优先级校验
        const validPriorities = Object.values(this.PRIORITIES);
        if (data.priority && !validPriorities.includes(data.priority)) {
            errors.push('无效的优先级值');
        }

        // 状态校验
        const validStatuses = Object.values(this.STATUSES);
        if (data.status && !validStatuses.includes(data.status)) {
            errors.push('无效的任务状态');
        }

        // 标签校验
        if (data.tags && !Array.isArray(data.tags)) {
            errors.push('标签格式错误');
        } else if (data.tags && data.tags.length > 10) {
            errors.push('标签数量不能超过10个');
        } else if (data.tags && data.tags.some(t => t.length > 20)) {
            errors.push('单个标签不能超过20个字符');
        }

        // 截止日期格式校验
        if (data.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
            errors.push('截止日期格式错误，应为 YYYY-MM-DD');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * 从表单数据构建任务对象
     * @param {FormData|Object} formData
     */
    fromForm(formData) {
        const tags = formData.tags
            ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
            : [];

        return {
            title: (formData.title || '').trim(),
            description: (formData.description || '').trim(),
            priority: formData.priority || this.PRIORITIES.MEDIUM,
            status: formData.status || this.STATUSES.TODO,
            tags: tags,
            dueDate: formData.dueDate || ''
        };
    },

    /**
     * 将任务对象转换为表单数据
     * @param {Object} task
     */
    toForm(task) {
        return {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            tags: task.tags.join(', '),
            dueDate: task.dueDate
        };
    },

    /**
     * 获取优先级对应的 CSS 类名
     * @param {string} priority
     */
    getPriorityClass(priority) {
        const map = {
            'high': 'priority-high',
            'medium': 'priority-medium',
            'low': 'priority-low'
        };
        return map[priority] || 'priority-medium';
    },

    /**
     * 获取优先级对应的徽标类名
     * @param {string} priority
     */
    getPriorityBadgeClass(priority) {
        const map = {
            'high': 'high',
            'medium': 'medium',
            'low': 'low'
        };
        return map[priority] || 'medium';
    },

    /**
     * 获取优先级图标
     * @param {string} priority
     */
    getPriorityIcon(priority) {
        const map = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        return map[priority] || '🟡';
    }
};
