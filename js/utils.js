/* ============================================
   Utils - 通用工具函数
   ============================================ */

const Utils = {
    /**
     * 生成唯一 ID
     */
    generateId() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // 降级方案
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * 防抖函数
     * @param {Function} fn
     * @param {number} delay 毫秒
     */
    debounce(fn, delay = 300) {
        let timer = null;
        return function (...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(this, args);
                timer = null;
            }, delay);
        };
    },

    /**
     * 格式化日期为 YYYY-MM-DD
     * @param {Date|string} date
     */
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 格式化日期为中文显示
     * @param {Date|string} date
     */
    formatDateCN(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        return `${year}年${month}月${day}日`;
    },

    /**
     * 判断日期是否已过期（不包含当天）
     * @param {string} dateStr YYYY-MM-DD
     */
    isOverdue(dateStr) {
        if (!dateStr) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        return target < today;
    },

    /**
     * 获取当前日期 YYYY-MM-DD
     */
    today() {
        return this.formatDate(new Date());
    },

    /**
     * 安全的 JSON 解析
     * @param {string} str
     * @param {*} fallback
     */
    safeJSONParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch {
            return fallback;
        }
    },

    /**
     * 创建 DOM 元素快捷方式
     * @param {string} tag
     * @param {Object} attrs
     * @param {string|Array} children
     */
    createElement(tag, attrs = {}, children = null) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([k, v]) => {
                    el.dataset[k] = v;
                });
            } else if (key.startsWith('on')) {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        });
        if (children !== null) {
            if (typeof children === 'string') {
                el.textContent = children;
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (typeof child === 'string') {
                        el.appendChild(document.createTextNode(child));
                    } else if (child instanceof HTMLElement) {
                        el.appendChild(child);
                    }
                });
            }
        }
        return el;
    },

    /**
     * 获取状态的中文名称
     * @param {string} status
     */
    getStatusLabel(status) {
        const map = {
            'todo': '待开始',
            'in-progress': '进行中',
            'done': '已完成'
        };
        return map[status] || status;
    },

    /**
     * 获取优先级的中文名称
     * @param {string} priority
     */
    getPriorityLabel(priority) {
        const map = {
            'high': '高优先级',
            'medium': '中优先级',
            'low': '低优先级'
        };
        return map[priority] || priority;
    }
};
