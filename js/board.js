/* ============================================
   Board - 看板渲染引擎（含完整拖拽交互 + 层级收纳 + 卡牌堆叠）
   ============================================ */

const Board = {
    /** 列容器映射 */
    columns: {
        todo: null,
        'in-progress': null,
        done: null
    },

    /** 列 DOM 元素（.board-column）映射 */
    columnElements: {
        todo: null,
        'in-progress': null,
        done: null
    },

    /** 计数元素映射 */
    counts: {
        todo: null,
        'in-progress': null,
        done: null
    },

    /** 当前拖拽状态 */
    _dragData: null,
    _dragStartColumn: null,
    _dragSnapshot: null,
    _dropExecuted: false,
    _dragOverTimer: null,
    _lastPlaceholderPosition: null,
    _isDropping: false,

    /** 层级偏好存储键 */
    HIERARCHY_KEY: 'ai-todo-board-hierarchy',
    /** 卡牌堆叠模式偏好键 */
    STACK_KEY: 'ai-todo-board-stack-mode',

    /** 当前右键选中的子任务 ID 集合 */
    _selectedChildren: new Set(),

    /** 当前选中的普通/父任务 ID 集合（用于 AI 一键整理） */
    _selectedForOrganize: new Set(),

    /** AI 一键整理按钮 DOM */
    _organizeBtn: null,

    /** 当前分类（daily / study） */
    _currentCategory: 'daily',

    /** 右键菜单 DOM */
    _contextMenu: null,

    /** 子任务详情弹窗 DOM */
    _detailModal: null,
    _detailOverlay: null,

    /** 移动端长按定时器 */
    _longPressTimer: null,
    _longPressTarget: null,

    /**
     * 初始化看板
     */
    init() {
        this.columns.todo = document.getElementById('column-todo');
        this.columns['in-progress'] = document.getElementById('column-in-progress');
        this.columns.done = document.getElementById('column-done');

        this.columnElements.todo = document.querySelector('.board-column[data-status="todo"]');
        this.columnElements['in-progress'] = document.querySelector('.board-column[data-status="in-progress"]');
        this.columnElements.done = document.querySelector('.board-column[data-status="done"]');

        this.counts.todo = document.getElementById('count-todo');
        this.counts['in-progress'] = document.getElementById('count-in-progress');
        this.counts.done = document.getElementById('count-done');

        this._initColumnDragEvents();
        this._initContextMenu();
        this._initGlobalClick();
        this._initDetailModal();
        this._initMobileLongPress();
        this._initOrganizeButton();
        this._initCategoryTabs();

        Store.onChange((tasks) => this.render(tasks));
    },

    // ============================================
    //  列拖拽事件
    // ============================================

    _initColumnDragEvents() {
        Object.entries(this.columnElements).forEach(([status, columnEl]) => {
            if (!columnEl) return;
            columnEl.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (!this._dragData) return;
                columnEl.classList.add('drag-over');
            });
            columnEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!this._dragData || this._isDropping) return;
                e.dataTransfer.dropEffect = 'move';
                if (this._dragOverTimer) return;
                this._dragOverTimer = requestAnimationFrame(() => {
                    this._dragOverTimer = null;
                    this._updateDragPlaceholder(e, status);
                });
            });
            columnEl.addEventListener('dragleave', (e) => {
                if (!columnEl.contains(e.relatedTarget)) {
                    columnEl.classList.remove('drag-over');
                    this._removePlaceholderFromColumn(status);
                }
            });
            columnEl.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this._isDropping) return;
                this._isDropping = true;
                columnEl.classList.remove('drag-over');
                this._removePlaceholderFromColumn(status);
                this._handleDrop(e, status);
            });
        });
    },

    // ============================================
    //  右键菜单
    // ============================================

    _initContextMenu() {
        this._contextMenu = document.createElement('div');
        this._contextMenu.className = 'context-menu hidden';
        this._contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="pack">📦 打包为子任务</div>
            <div class="context-menu-item" data-action="unbind">🔓 解绑子任务</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="toggle-stack">🃏 切换卡牌堆叠</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="expand-all">📂 全部展开子任务</div>
            <div class="context-menu-item" data-action="collapse-all">📁 全部折叠子任务</div>
        `;
        document.body.appendChild(this._contextMenu);

        this._contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;
            this._handleContextAction(item.dataset.action);
            this._hideContextMenu();
        });
    },

    _initGlobalClick() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) this._hideContextMenu();
            if (!e.target.closest('.subtask-card.selected-child')) this._clearChildSelection();
            if (!e.target.closest('.subtask-detail-modal') && !e.target.closest('.subtask-detail-overlay')) {
                this._hideDetailModal();
            }
        });
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.board-container')) e.preventDefault();
        });
    },

    _showContextMenu(x, y, parentId) {
        this._contextMenu.dataset.parentId = parentId || '';
        this._contextMenu.classList.remove('hidden');
        this._contextMenu.style.left = x + 'px';
        this._contextMenu.style.top = y + 'px';
        const rect = this._contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this._contextMenu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            this._contextMenu.style.top = (window.innerHeight - rect.height - 10) + 'px';
        }
    },

    _hideContextMenu() {
        this._contextMenu.classList.add('hidden');
    },

    _handleContextAction(action) {
        const parentId = this._contextMenu.dataset.parentId;
        switch (action) {
            case 'pack': this._packSelectedChildren(parentId); break;
            case 'unbind': this._unbindSelectedChildren(); break;
            case 'toggle-stack': this._toggleStackMode(parentId); break;
            case 'expand-all': this._toggleAllSubtasks(parentId, true); break;
            case 'collapse-all': this._toggleAllSubtasks(parentId, false); break;
        }
    },

    // ============================================
    //  卡牌堆叠模式
    // ============================================

    _toggleStackMode(parentId) {
        if (!parentId) return;
        const parent = Store.getById(parentId);
        if (!parent) return;
        const current = this._getStackMode(parentId);
        this._saveStackMode(parentId, !current);
        parent.updatedAt = new Date().toISOString();
        Store._persist();
        Store._notify();
    },

    _getStackMode(parentId) {
        try {
            const modes = Utils.safeJSONParse(localStorage.getItem(this.STACK_KEY), {});
            return modes[parentId] === true;
        } catch { return false; }
    },

    _saveStackMode(parentId, enabled) {
        try {
            const modes = Utils.safeJSONParse(localStorage.getItem(this.STACK_KEY), {});
            modes[parentId] = enabled;
            localStorage.setItem(this.STACK_KEY, JSON.stringify(modes));
        } catch (e) { console.error('保存堆叠模式失败:', e); }
    },

    // ============================================
    //  子任务详情弹窗
    // ============================================

    _initDetailModal() {
        this._detailOverlay = document.createElement('div');
        this._detailOverlay.className = 'subtask-detail-overlay hidden';
        document.body.appendChild(this._detailOverlay);

        this._detailModal = document.createElement('div');
        this._detailModal.className = 'subtask-detail-modal hidden';
        document.body.appendChild(this._detailModal);

        this._detailOverlay.addEventListener('click', () => this._hideDetailModal());
    },

    _showDetailModal(child) {
        if (!child) return;
        const parent = Store.getById(child.parentId);
        let html = `<div class="subtask-detail-header">
            <span class="subtask-detail-title">${this._escapeHtml(child.title)}</span>
            <button class="subtask-detail-close">✕</button>
        </div>`;

        if (child.description) {
            html += `<div class="subtask-detail-section">
                <div class="subtask-detail-label">📝 描述</div>
                <div class="subtask-detail-text">${this._escapeHtml(child.description)}</div>
            </div>`;
        }

        html += `<div class="subtask-detail-section">
            <div class="subtask-detail-label">🏷️ 优先级</div>
            <div class="subtask-detail-text">
                <span class="priority-badge ${Task.getPriorityBadgeClass(child.priority)}">${Task.getPriorityIcon(child.priority)} ${Utils.getPriorityLabel(child.priority)}</span>
            </div>
        </div>`;

        if (child.tags && child.tags.length > 0) {
            html += `<div class="subtask-detail-section">
                <div class="subtask-detail-label">🔖 标签</div>
                <div class="subtask-detail-tags">`;
            child.tags.forEach(tag => {
                html += `<span class="task-tag">${this._escapeHtml(tag)}</span>`;
            });
            html += `</div></div>`;
        }

        if (child.dueDate) {
            const overdue = Utils.isOverdue(child.dueDate);
            html += `<div class="subtask-detail-section">
                <div class="subtask-detail-label">📅 截止时间</div>
                <div class="subtask-detail-text ${overdue ? 'overdue' : ''}">${Utils.formatDateCN(child.dueDate)}${overdue ? ' ⚠️ 已逾期' : ''}</div>
            </div>`;
        }

        if (parent) {
            html += `<div class="subtask-detail-section">
                <div class="subtask-detail-label">📂 所属父任务</div>
                <div class="subtask-detail-text">${this._escapeHtml(parent.title)}</div>
            </div>`;
        }

        html += `<div class="subtask-detail-section">
            <div class="subtask-detail-label">📊 状态</div>
            <div class="subtask-detail-text">${Utils.getStatusLabel(child.status)}</div>
        </div>`;

        html += `<div class="subtask-detail-actions">
            <button class="task-action-btn edit" data-action="edit">✏️ 编辑</button>
            <button class="task-action-btn delete" data-action="delete">🗑️ 删除</button>
        </div>`;

        this._detailModal.innerHTML = html;
        this._detailModal.classList.remove('hidden');
        this._detailOverlay.classList.remove('hidden');

        // 居中
        this._detailModal.style.left = '50%';
        this._detailModal.style.top = '50%';
        this._detailModal.style.transform = 'translate(-50%, -50%)';

        // 关闭按钮
        this._detailModal.querySelector('.subtask-detail-close').addEventListener('click', () => this._hideDetailModal());

        // 编辑/删除
        this._detailModal.querySelector('[data-action="edit"]').addEventListener('click', () => {
            this._hideDetailModal();
            this._onEditTask(child);
        });
        this._detailModal.querySelector('[data-action="delete"]').addEventListener('click', () => {
            this._hideDetailModal();
            this._onDeleteTask(child);
        });
    },

    _hideDetailModal() {
        this._detailModal.classList.add('hidden');
        this._detailOverlay.classList.add('hidden');
    },

    // ============================================
    //  移动端长按支持
    // ============================================

    _initMobileLongPress() {
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.task-card-parent') || e.target.closest('.subtask-card');
            if (!target) return;
            this._longPressTarget = target;
            this._longPressTimer = setTimeout(() => {
                if (!this._longPressTarget) return;
                // 触发震动反馈（如果支持）
                if (navigator.vibrate) navigator.vibrate(20);
                // 模拟右键
                const touch = e.touches[0];
                const customEvent = new MouseEvent('contextmenu', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true,
                    cancelable: true
                });
                this._longPressTarget.dispatchEvent(customEvent);
                this._longPressTarget = null;
            }, 600);
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (this._longPressTimer) {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            }
            this._longPressTarget = null;
        }, { passive: true });

        document.addEventListener('touchmove', () => {
            if (this._longPressTimer) {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            }
            this._longPressTarget = null;
        }, { passive: true });
    },

    // ============================================
    //  打包/解绑/展开/折叠
    // ============================================

    _packSelectedChildren(parentId) {
        if (!parentId || this._selectedChildren.size === 0) {
            alert('请先右键选中子任务（点击子任务卡片选中，会高亮显示）');
            return;
        }
        const childIds = Array.from(this._selectedChildren).filter(id => id !== parentId);
        if (childIds.length === 0) return;
        const parentTitle = prompt('请输入父任务标题：', '父任务');
        if (!parentTitle) return;
        const parent = Store.add({
            title: parentTitle,
            status: Store.getById(childIds[0])?.status || 'todo',
            priority: 'medium',
            children: childIds,
            isParent: true
        });
        Store.packAsChildren(parent.id, childIds);
        this._clearChildSelection();
    },

    _unbindSelectedChildren() {
        if (this._selectedChildren.size === 0) {
            alert('请先右键选中要解绑的子任务');
            return;
        }
        if (!confirm(`确定要解绑 ${this._selectedChildren.size} 个选中的子任务吗？`)) return;
        this._selectedChildren.forEach(childId => Store.unbindChild(childId));
        this._clearChildSelection();
    },

    _toggleAllSubtasks(parentId, show) {
        if (!parentId) return;
        const parent = Store.getById(parentId);
        if (!parent) return;
        parent.showSubtasks = show;
        parent.updatedAt = new Date().toISOString();
        this._saveHierarchyPreference(parentId, show);
        Store._persist();
        Store._notify();
    },

    _saveHierarchyPreference(parentId, show) {
        try {
            const prefs = Utils.safeJSONParse(localStorage.getItem(this.HIERARCHY_KEY), {});
            prefs[parentId] = { showSubtasks: show };
            localStorage.setItem(this.HIERARCHY_KEY, JSON.stringify(prefs));
        } catch (e) { console.error('保存层级偏好失败:', e); }
    },

    _loadHierarchyPreference(parentId) {
        try {
            const prefs = Utils.safeJSONParse(localStorage.getItem(this.HIERARCHY_KEY), {});
            return prefs[parentId];
        } catch { return null; }
    },

    _clearChildSelection() {
        this._selectedChildren.clear();
        document.querySelectorAll('.subtask-card.selected-child').forEach(el => el.classList.remove('selected-child'));
    },

    // ============================================
    //  渲染
    // ============================================

    render(tasks) {
        // tasks 已由 Store 按当前分类隔离，无需再次过滤
        this._renderColumn('todo', tasks);
        this._renderColumn('in-progress', tasks);
        this._renderColumn('done', tasks);
        this._updateCounts(tasks);
    },

    /**
     * 获取任务对应的 boardStatus 值
     * @param {Object} task
     */
    _getBoardStatus(task) {
        if (task.boardStatus) return task.boardStatus;
        // 兼容旧数据：根据 status 推断
        const map = { 'todo': 'pending', 'in-progress': 'ongoing', 'done': 'finished' };
        return map[task.status] || 'pending';
    },

    /**
     * 构建状态下拉框 HTML
     * @param {Object} task
     * @param {string} variant 'parent' | 'child' | 'normal'
     */
    _buildStatusDropdown(task, variant) {
        const current = this._getBoardStatus(task);
        const options = [
            { value: 'pending', label: '📝 待开始' },
            { value: 'ongoing', label: '🔄 进行中' },
            { value: 'finished', label: '✅ 已完成' }
        ];
        const selectClass = variant === 'parent' ? 'status-select status-select-parent' :
                            variant === 'child' ? 'status-select status-select-child' :
                            'status-select status-select-normal';
        let html = `<select class="${selectClass}" data-task-id="${task.id}" data-variant="${variant}">`;
        options.forEach(opt => {
            const selected = opt.value === current ? ' selected' : '';
            html += `<option value="${opt.value}"${selected}>${opt.label}</option>`;
        });
        html += '</select>';
        return html;
    },

    _renderColumn(status, allTasks) {
        const container = this.columns[status];
        if (!container) return;

        const parentTasks = allTasks.filter(t => t.status === status && !t.parentId);
        const childTasks = allTasks.filter(t => t.status === status && t.parentId);

        container.innerHTML = '';

        if (parentTasks.length === 0 && childTasks.length === 0) {
            container.appendChild(this._createEmptyState(status));
            return;
        }

        parentTasks.forEach((task, index) => {
            const card = this._createParentTaskCard(task, index, allTasks);
            container.appendChild(card);
        });

        const orphanChildren = childTasks.filter(t => {
            const parent = allTasks.find(p => p.id === t.parentId);
            return !parent;
        });
        orphanChildren.forEach((task, index) => {
            const card = this._createTaskCard(task, index);
            container.appendChild(card);
        });
    },

    _createEmptyState(status) {
        const icons = { 'todo': '📝', 'in-progress': '🔄', 'done': '✅' };
        const texts = {
            'todo': '暂无待办任务\n点击上方 "+ 新增任务" 开始',
            'in-progress': '暂无进行中的任务\n拖拽任务卡片到这里',
            'done': '暂无已完成的任务\n完成的任务会出现在这里'
        };
        const wrapper = document.createElement('div');
        wrapper.className = 'empty-state';
        wrapper.innerHTML = `<div class="empty-state-icon">${icons[status] || '📋'}</div><div class="empty-state-text">${texts[status] || ''}</div>`;
        return wrapper;
    },

    _createTaskCard(task, index) {
        const card = document.createElement('div');
        card.className = `task-card ${Task.getPriorityClass(task.priority)}`;
        card.dataset.taskId = task.id;
        card.dataset.index = index;
        card.draggable = true;

        let html = `<div class="task-title">${this._escapeHtml(task.title)}</div>`;
        if (task.description) {
            const desc = task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description;
            html += `<div class="task-desc-preview">${this._escapeHtml(desc)}</div>`;
        }
        html += '<div class="task-meta">';
        html += `<span class="priority-badge ${Task.getPriorityBadgeClass(task.priority)}">${Task.getPriorityIcon(task.priority)} ${Utils.getPriorityLabel(task.priority)}</span>`;
        if (task.tags && task.tags.length > 0) {
            html += '<span class="task-tags">' + task.tags.map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`).join('') + '</span>';
        }
        if (task.dueDate) {
            const overdue = Utils.isOverdue(task.dueDate);
            html += `<span class="task-due-date ${overdue ? 'overdue' : ''}">📅 ${Utils.formatDateCN(task.dueDate)}${overdue ? ' ⚠️' : ''}</span>`;
        }
        html += '</div><div class="task-actions">';
        html += this._buildStatusDropdown(task, 'normal');
        html += `<button class="task-action-btn edit" data-action="edit" title="编辑">✏️ 编辑</button>`;
        html += `<button class="task-action-btn delete" data-action="delete" title="删除">🗑️ 删除</button></div>`;

        card.innerHTML = html;
        card.addEventListener('dragstart', (e) => this._onDragStart(e, task));
        card.addEventListener('dragend', (e) => this._onDragEnd(e));
        card.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); this._onEditTask(task); });
        card.querySelector('[data-action="delete"]').addEventListener('click', (e) => { e.stopPropagation(); this._onDeleteTask(task); });
        this._bindStatusDropdown(card, task, 'normal');
        // 点击选中（用于 AI 一键整理）
        card.addEventListener('click', (e) => {
            if (e.target.closest('.task-actions') || e.target.closest('.status-select')) return;
            e.stopPropagation();
            card.classList.toggle('selected-for-organize');
            if (card.classList.contains('selected-for-organize')) {
                this._selectedForOrganize.add(task.id);
            } else {
                this._selectedForOrganize.delete(task.id);
            }
            this._updateOrganizeButton();
        });
        return card;
    },

    /**
     * 创建父任务卡片（含内部子任务堆叠容器、展开/折叠、右键翻页、卡牌堆叠）
     */
    _createParentTaskCard(task, index, allTasks) {
        const card = document.createElement('div');
        card.className = `task-card task-card-parent ${Task.getPriorityClass(task.priority)}`;
        card.dataset.taskId = task.id;
        card.dataset.index = index;
        card.draggable = true;

        const children = Store.getChildren(task.id);
        const childCount = children.length;
        const isExpanded = task.showSubtasks !== false;
        const isRealParent = task.isParent === true && childCount > 0;
        const isStackMode = isRealParent && this._getStackMode(task.id);

        // 导航区域
        if (isRealParent) {
            let navHtml = '<div class="parent-nav-area">';
            navHtml += `<span class="parent-nav-arrow parent-nav-prev" title="上一个父任务">◀</span>`;
            navHtml += `<span class="parent-toggle-btn" title="${isExpanded ? '折叠' : '展开'}子任务">${isExpanded ? '▼' : '▶'}</span>`;
            navHtml += `<span class="parent-nav-arrow parent-nav-next" title="下一个父任务">▶</span>`;
            navHtml += '</div>';
            card.innerHTML += navHtml;
        }

        let html = `<div class="task-title">${this._escapeHtml(task.title)}</div>`;
        if (isRealParent) {
            html += `<div class="parent-badge">📂 ${childCount} 个子任务</div>`;
        }
        if (task.description) {
            const desc = task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description;
            html += `<div class="task-desc-preview">${this._escapeHtml(desc)}</div>`;
        }
        if (isRealParent && childCount > 0) {
            html += `<div class="subtask-toggle-bar">
                <label class="subtask-toggle-label">
                    <input type="checkbox" class="subtask-toggle-checkbox" ${isExpanded ? 'checked' : ''}>
                    <span>全部展开子任务标签（${childCount} 项）</span>
                </label>
            </div>`;
        }
        html += '<div class="task-meta">';
        html += `<span class="priority-badge ${Task.getPriorityBadgeClass(task.priority)}">${Task.getPriorityIcon(task.priority)} ${Utils.getPriorityLabel(task.priority)}</span>`;
        if (task.tags && task.tags.length > 0) {
            html += '<span class="task-tags">' + task.tags.map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`).join('') + '</span>';
        }
        if (task.dueDate) {
            const overdue = Utils.isOverdue(task.dueDate);
            html += `<span class="task-due-date ${overdue ? 'overdue' : ''}">📅 ${Utils.formatDateCN(task.dueDate)}${overdue ? ' ⚠️' : ''}</span>`;
        }
        html += '</div><div class="task-actions">';
        html += this._buildStatusDropdown(task, 'parent');
        html += `<button class="task-action-btn edit" data-action="edit" title="编辑">✏️ 编辑</button>`;
        html += `<button class="task-action-btn delete" data-action="delete" title="删除">🗑️ 删除</button></div>`;

        // 子任务堆叠容器
        if (isRealParent && isExpanded) {
            html += `<div class="subtask-stack ${isStackMode ? 'stack-mode' : ''}">`;
            children.forEach((child, idx) => {
                html += this._buildSubTaskHTML(child, idx, children.length, isStackMode);
            });
            // 子任务总数徽标
            if (childCount > 0) {
                html += `<div class="subtask-count-badge">${childCount}</div>`;
            }
            html += '</div>';
        }

        card.innerHTML = html;

        // 拖拽
        card.addEventListener('dragstart', (e) => this._onDragStart(e, task));
        card.addEventListener('dragend', (e) => this._onDragEnd(e));

        // 编辑/删除
        card.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); this._onEditTask(task); });
        card.querySelector('[data-action="delete"]').addEventListener('click', (e) => { e.stopPropagation(); this._onDeleteTask(task); });

        if (isRealParent) {
            const toggleBtn = card.querySelector('.parent-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Store.toggleSubtasks(task.id);
                    this._saveHierarchyPreference(task.id, !isExpanded);
                });
            }
            const toggleCheckbox = card.querySelector('.subtask-toggle-checkbox');
            if (toggleCheckbox) {
                toggleCheckbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    Store.toggleAllSubtasksVisibility(task.id);
                    this._saveHierarchyPreference(task.id, e.target.checked);
                });
            }
            const titleEl = card.querySelector('.task-title');
            titleEl.addEventListener('click', (e) => {
                if (!e.target.closest('.parent-nav-area') && !e.target.closest('.task-actions')) {
                    Store.toggleSubtasks(task.id);
                    this._saveHierarchyPreference(task.id, !isExpanded);
                }
            });
            const navPrev = card.querySelector('.parent-nav-prev');
            const navNext = card.querySelector('.parent-nav-next');
            if (navPrev) navPrev.addEventListener('click', (e) => { e.stopPropagation(); this._navigateParentTask(task.id, -1); });
            if (navNext) navNext.addEventListener('click', (e) => { e.stopPropagation(); this._navigateParentTask(task.id, 1); });
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._showContextMenu(e.clientX, e.clientY, task.id);
            });
        }

        // 点击选中父任务（用于 AI 一键整理）
        card.addEventListener('click', (e) => {
            if (e.target.closest('.task-actions') || e.target.closest('.status-select') ||
                e.target.closest('.parent-nav-area') || e.target.closest('.subtask-stack') ||
                e.target.closest('.subtask-toggle-bar')) return;
            e.stopPropagation();
            card.classList.toggle('selected-for-organize');
            if (card.classList.contains('selected-for-organize')) {
                this._selectedForOrganize.add(task.id);
            } else {
                this._selectedForOrganize.delete(task.id);
            }
            this._updateOrganizeButton();
        });

        // 子任务事件委托
        if (isRealParent && isExpanded) {
            const stack = card.querySelector('.subtask-stack');
            if (stack) {
                // 使用 data 属性记录父任务 ID，事件触发时实时读取堆叠模式
                stack.dataset.parentId = task.id;

                stack.addEventListener('click', (e) => {
                    const subCard = e.target.closest('.subtask-card');
                    if (!subCard || e.target.closest('.task-actions')) return;
                    const childId = subCard.dataset.taskId;
                    const child = allTasks.find(t => t.id === childId);
                    if (!child) return;

                    // 实时读取堆叠模式（避免闭包捕获旧值）
                    const parentId = e.currentTarget.dataset.parentId;
                    const currentStackMode = this._getStackMode(parentId);

                    if (currentStackMode) {
                        this._showDetailModal(child);
                        return;
                    }

                    subCard.classList.toggle('selected-child');
                    if (subCard.classList.contains('selected-child')) {
                        this._selectedChildren.add(childId);
                    } else {
                        this._selectedChildren.delete(childId);
                    }
                });

                stack.addEventListener('contextmenu', (e) => {
                    const subCard = e.target.closest('.subtask-card');
                    if (!subCard) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const childId = subCard.dataset.taskId;
                    const child = allTasks.find(t => t.id === childId);
                    if (!child) return;

                    // 实时读取堆叠模式
                    const parentId = e.currentTarget.dataset.parentId;
                    const currentStackMode = this._getStackMode(parentId);

                    if (currentStackMode) {
                        this._showDetailModal(child);
                        return;
                    }

                    subCard.classList.add('selected-child');
                    this._selectedChildren.add(childId);
                    this._showContextMenu(e.clientX, e.clientY, task.id);
                });

                stack.addEventListener('click', (e) => {
                    const btn = e.target.closest('.task-action-btn');
                    if (!btn) return;
                    const subCard = btn.closest('.subtask-card');
                    if (!subCard) return;
                    const childId = subCard.dataset.taskId;
                    const child = allTasks.find(t => t.id === childId);
                    if (!child) return;
                    if (btn.dataset.action === 'edit') { e.stopPropagation(); this._onEditTask(child); }
                    else if (btn.dataset.action === 'delete') { e.stopPropagation(); this._onDeleteTask(child); }
                });
            }
        }

        return card;
    },

    /**
     * 构建子任务 HTML（支持卡牌堆叠模式）
     * @param {Object} child
     * @param {number} index 在父任务中的索引
     * @param {number} total 子任务总数
     * @param {boolean} isStackMode 是否堆叠模式
     */
    _buildSubTaskHTML(child, index, total, isStackMode) {
        // 堆叠模式下自动缩减偏移量
        let offsetX = 6;
        let offsetY = 4;
        if (total > 10) {
            offsetX = Math.max(2, offsetX - Math.floor((total - 10) / 3));
            offsetY = Math.max(1, offsetY - Math.floor((total - 10) / 4));
        }

        // 堆叠模式使用 transform 实现偏移（position: absolute 布局）
        const stackStyle = isStackMode
            ? ` style="z-index:${total - index};transform:translate(${offsetX * index}px, ${offsetY * index}px);"`
            : '';

        let html = `<div class="subtask-card ${Task.getPriorityClass(child.priority)}" data-task-id="${child.id}"${stackStyle}>`;

        html += `<div class="subtask-content">
            <div class="task-title">${this._escapeHtml(child.title)}</div>`;

        // 堆叠模式下隐藏详情文本，仅显示标题和优先级色条
        if (!isStackMode && child.description) {
            const desc = child.description.length > 80 ? child.description.substring(0, 80) + '...' : child.description;
            html += `<div class="task-desc-preview">${this._escapeHtml(desc)}</div>`;
        }

        // 堆叠模式下隐藏 meta 区域（仅保留优先级色条通过 ::before 显示）
        if (!isStackMode) {
            html += '<div class="task-meta">';
            html += `<span class="priority-badge ${Task.getPriorityBadgeClass(child.priority)}">${Task.getPriorityIcon(child.priority)} ${Utils.getPriorityLabel(child.priority)}</span>`;
            if (child.tags && child.tags.length > 0) {
                html += '<span class="task-tags">' + child.tags.map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`).join('') + '</span>';
            }
            if (child.dueDate) {
                const overdue = Utils.isOverdue(child.dueDate);
                html += `<span class="task-due-date ${overdue ? 'overdue' : ''}">📅 ${Utils.formatDateCN(child.dueDate)}${overdue ? ' ⚠️' : ''}</span>`;
            }
            html += '</div>';
        }

        // 堆叠模式下隐藏操作按钮
        if (!isStackMode) {
            html += '<div class="task-actions">';
            html += this._buildStatusDropdown(child, 'child');
            html += `<button class="task-action-btn edit" data-action="edit" title="编辑">✏️ 编辑</button>`;
            html += `<button class="task-action-btn delete" data-action="delete" title="删除">🗑️ 删除</button>`;
            html += '</div>';
        }

        html += '</div></div>';
        return html;
    },

    _createSubTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card subtask-card ${Task.getPriorityClass(task.priority)}`;
        card.dataset.taskId = task.id;
        card.draggable = true;

        let html = `<div class="subtask-indent"></div>
            <div class="subtask-content">
                <div class="task-title">${this._escapeHtml(task.title)}</div>`;
        if (task.description) {
            const desc = task.description.length > 80 ? task.description.substring(0, 80) + '...' : task.description;
            html += `<div class="task-desc-preview">${this._escapeHtml(desc)}</div>`;
        }
        html += '<div class="task-meta">';
        html += `<span class="priority-badge ${Task.getPriorityBadgeClass(task.priority)}">${Task.getPriorityIcon(task.priority)} ${Utils.getPriorityLabel(task.priority)}</span>`;
        if (task.tags && task.tags.length > 0) {
            html += '<span class="task-tags">' + task.tags.map(t => `<span class="task-tag">${this._escapeHtml(t)}</span>`).join('') + '</span>';
        }
        if (task.dueDate) {
            const overdue = Utils.isOverdue(task.dueDate);
            html += `<span class="task-due-date ${overdue ? 'overdue' : ''}">📅 ${Utils.formatDateCN(task.dueDate)}${overdue ? ' ⚠️' : ''}</span>`;
        }
        html += '</div><div class="task-actions">';
        html += `<button class="task-action-btn edit" data-action="edit" title="编辑">✏️ 编辑</button>`;
        html += `<button class="task-action-btn delete" data-action="delete" title="删除">🗑️ 删除</button></div></div>`;

        card.innerHTML = html;
        card.addEventListener('dragstart', (e) => this._onDragStart(e, task));
        card.addEventListener('dragend', (e) => this._onDragEnd(e));
        card.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); this._onEditTask(task); });
        card.querySelector('[data-action="delete"]').addEventListener('click', (e) => { e.stopPropagation(); this._onDeleteTask(task); });
        card.addEventListener('click', (e) => {
            if (e.target.closest('.task-actions')) return;
            e.stopPropagation();
            card.classList.toggle('selected-child');
            if (card.classList.contains('selected-child')) this._selectedChildren.add(task.id);
            else this._selectedChildren.delete(task.id);
        });
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('selected-child');
            this._selectedChildren.add(task.id);
            const parent = Store.getAll().find(t => t.id === task.parentId);
            this._showContextMenu(e.clientX, e.clientY, parent ? parent.id : '');
        });
        return card;
    },

    _navigateParentTask(currentId, direction) {
        const next = Store.navigateParent(currentId, direction);
        if (!next) {
            const card = document.querySelector(`.task-card[data-task-id="${currentId}"]`);
            if (card) {
                card.style.transition = 'all 0.2s ease';
                card.style.boxShadow = '0 0 0 2px var(--color-warning)';
                setTimeout(() => { card.style.boxShadow = ''; }, 400);
            }
            return;
        }
        const targetCard = document.querySelector(`.task-card[data-task-id="${next.id}"]`);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.style.transition = 'all 0.22s ease';
            targetCard.style.boxShadow = '0 0 0 3px var(--color-primary)';
            setTimeout(() => { targetCard.style.boxShadow = ''; }, 600);
        }
    },

    // ============================================
    //  拖拽事件处理
    // ============================================

    _onDragStart(e, task) {
        this._dragSnapshot = {
            tasks: JSON.parse(JSON.stringify(Store.getAll())),
            taskId: task.id
        };
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => { e.target.classList.add('dragging'); });
        this._dragData = { taskId: task.id, fromStatus: task.status, fromIndex: task.index };
        this._dragStartColumn = task.status;
    },

    _onDragEnd(e) {
        e.target.classList.remove('dragging');
        this._clearDragVisuals();
        if (this._dragData && !this._dropExecuted) this._rollbackDrag();
        this._dragData = null;
        this._dragStartColumn = null;
        this._dropExecuted = false;
        this._isDropping = false;
        this._lastPlaceholderPosition = null;
    },

    _handleDrop(e, targetStatus) {
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId || !this._dragData) { this._isDropping = false; return; }
        const fromStatus = this._dragData.fromStatus;
        const targetIndex = this._calculateDropIndex(e, targetStatus);
        try {
            if (fromStatus === targetStatus) {
                Store.reorder(taskId, targetIndex);
            } else {
                Store.move(taskId, targetStatus, targetIndex);
            }
            this._dropExecuted = true;
        } catch (err) {
            console.error('拖拽操作失败，执行回滚:', err);
            this._rollbackDrag();
        }
        this._isDropping = false;
    },

    _getScrollOffset(container) {
        let scrollTop = 0;
        let el = container.parentElement;
        while (el) { scrollTop += el.scrollTop || 0; el = el.parentElement; }
        return scrollTop;
    },

    _calculateDropIndex(e, status) {
        const container = this.columns[status];
        if (!container) return 0;
        const cards = container.querySelectorAll('.task-card:not(.dragging)');
        if (cards.length === 0) return 0;
        const scrollOffset = this._getScrollOffset(container);
        const containerRect = container.getBoundingClientRect();
        const mouseYRelative = (e.clientY - containerRect.top) + scrollOffset;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const cardRect = card.getBoundingClientRect();
            const cardTopRelative = (cardRect.top - containerRect.top) + scrollOffset;
            const splitPoint = cardTopRelative + cardRect.height * 0.35;
            if (mouseYRelative < splitPoint) return i;
        }
        return cards.length;
    },

    _updateDragPlaceholder(e, status) {
        const container = this.columns[status];
        if (!container) return;
        Object.values(this.columns).forEach(col => {
            if (col && col !== container) { const ph = col.querySelector('.drag-placeholder'); if (ph) ph.remove(); }
        });
        const cards = container.querySelectorAll('.task-card:not(.dragging)');
        const scrollOffset = this._getScrollOffset(container);
        const containerRect = container.getBoundingClientRect();
        const mouseYRelative = (e.clientY - containerRect.top) + scrollOffset;
        let insertBefore = null;
        let insertIndex = cards.length;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const cardRect = card.getBoundingClientRect();
            const cardTopRelative = (cardRect.top - containerRect.top) + scrollOffset;
            const splitPoint = cardTopRelative + cardRect.height * 0.35;
            if (mouseYRelative < splitPoint) { insertBefore = card; insertIndex = i; break; }
        }
        if (this._lastPlaceholderPosition && this._lastPlaceholderPosition.status === status && this._lastPlaceholderPosition.index === insertIndex) return;
        const oldPlaceholder = container.querySelector('.drag-placeholder');
        if (oldPlaceholder) oldPlaceholder.remove();
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        if (insertBefore) container.insertBefore(placeholder, insertBefore);
        else container.appendChild(placeholder);
        requestAnimationFrame(() => placeholder.classList.add('drag-placeholder-active'));
        this._lastPlaceholderPosition = { status, index: insertIndex };
    },

    _removePlaceholderFromColumn(status) {
        const container = this.columns[status];
        if (container) { const ph = container.querySelector('.drag-placeholder'); if (ph) ph.remove(); }
    },

    _clearDragVisuals() {
        Object.values(this.columnElements).forEach(el => { if (el) el.classList.remove('drag-over'); });
        document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
    },

    _rollbackDrag() {
        if (!this._dragSnapshot) return;
        console.warn('⚠️ 拖拽操作已回滚');
        try {
            // 使用 Store 的内部方法恢复当前分类的快照数据
            const key = Store._getStorageKey();
            localStorage.setItem(key, JSON.stringify(this._dragSnapshot.tasks));
            Store.init();
        } catch (err) { console.error('回滚失败:', err); }
        this._dragSnapshot = null;
    },

    // ============================================
    //  回调注册
    // ============================================

    _onEditTask: null,
    _onDeleteTask: null,

    setEditHandler(handler) { this._onEditTask = handler; },
    setDeleteHandler(handler) { this._onDeleteTask = handler; },

    // ============================================
    //  辅助方法
    // ============================================

    _updateCounts(tasks) {
        const counts = {
            todo: tasks.filter(t => t.status === 'todo').length,
            'in-progress': tasks.filter(t => t.status === 'in-progress').length,
            done: tasks.filter(t => t.status === 'done').length
        };
        Object.entries(counts).forEach(([status, count]) => { if (this.counts[status]) this.counts[status].textContent = count; });
    },

    /**
     * 绑定状态下拉框事件
     * @param {HTMLElement} card 卡片 DOM
     * @param {Object} task 任务对象
     * @param {string} variant 'parent' | 'child' | 'normal'
     */
    _bindStatusDropdown(card, task, variant) {
        const select = card.querySelector('.status-select');
        if (!select) return;

        select.addEventListener('change', (e) => {
            e.stopPropagation();
            const newStatus = e.target.value;
            const taskId = select.dataset.taskId;

            if (variant === 'parent') {
                // 父任务：整体迁移
                Store.setParentStatus(taskId, newStatus);
            } else if (variant === 'child') {
                // 子任务：单独迁移并解绑
                Store.setSingleChildStatus(taskId, newStatus);
            } else {
                // 普通任务：仅更新自身状态
                const taskObj = Store.getById(taskId);
                if (taskObj) {
                    const statusMap = { 'pending': 'todo', 'ongoing': 'in-progress', 'finished': 'done' };
                    const newLegacyStatus = statusMap[newStatus] || 'todo';
                    Store.update(taskId, {
                        boardStatus: newStatus,
                        status: newLegacyStatus
                    });
                }
            }
        });
    },

    // ============================================
    //  分类 Tab 切换
    // ============================================

    /**
     * 初始化分类 Tab 栏
     */
    _initCategoryTabs() {
        const tabs = document.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                if (category === this._currentCategory) return;

                // 切换高亮
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 更新当前分类
                this._currentCategory = category;
                this._clearOrganizeSelection();

                // 通知 Store 切换分类存储池（会触发重新加载 + notify）
                Store.setCategory(category);
            });
        });
    },

    /**
     * 获取当前分类下的任务
     * @param {Array} tasks 所有任务
     */
    _getCategoryTasks(tasks) {
        return tasks.filter(t => (t.category || 'daily') === this._currentCategory);
    },

    // ============================================
    //  AI 一键归集整理
    // ============================================

    /**
     * 初始化 AI 一键整理按钮
     */
    _initOrganizeButton() {
        this._organizeBtn = document.getElementById('btnAiOrganize');
        if (!this._organizeBtn) return;

        this._organizeBtn.addEventListener('click', () => this._handleOrganizeTasks());
    },

    /**
     * 切换任务选中状态（用于 AI 一键整理）
     * @param {string} taskId
     */
    _toggleTaskSelection(taskId) {
        if (this._selectedForOrganize.has(taskId)) {
            this._selectedForOrganize.delete(taskId);
        } else {
            this._selectedForOrganize.add(taskId);
        }
        this._updateOrganizeButton();
    },

    /**
     * 更新 AI 一键整理按钮可见性
     */
    _updateOrganizeButton() {
        if (!this._organizeBtn) return;
        if (this._selectedForOrganize.size >= 2) {
            this._organizeBtn.classList.remove('hidden');
            this._organizeBtn.textContent = `📦 AI 一键整理 (${this._selectedForOrganize.size})`;
        } else {
            this._organizeBtn.classList.add('hidden');
        }
    },

    /**
     * 清除所有选中（用于 AI 整理）
     */
    _clearOrganizeSelection() {
        this._selectedForOrganize.clear();
        document.querySelectorAll('.task-card.selected-for-organize').forEach(el => el.classList.remove('selected-for-organize'));
        this._updateOrganizeButton();
    },

    /**
     * 处理 AI 一键归集整理
     */
    async _handleOrganizeTasks() {
        if (this._selectedForOrganize.size < 2) {
            alert('请至少选中 2 个任务进行整理');
            return;
        }

        // 收集选中任务数据
        const selectedTasks = [];
        this._selectedForOrganize.forEach(taskId => {
            const task = Store.getById(taskId);
            if (task) {
                selectedTasks.push({
                    id: task.id,
                    title: task.title,
                    description: task.description || '',
                    tags: task.tags || [],
                    priority: task.priority
                });
            }
        });

        if (selectedTasks.length < 2) {
            alert('选中的任务数据异常，请重试');
            return;
        }

        // 询问用户是否自定义父任务标题
        const useCustomTitle = confirm('是否自定义父任务标题？\n\n点击「确定」输入自定义标题\n点击「取消」让 AI 自动命名');
        let customParentTitle = '';
        if (useCustomTitle) {
            customParentTitle = prompt('请输入父任务标题：', '');
            if (customParentTitle === null) return; // 用户取消
        }

        // 显示加载状态
        this._organizeBtn.textContent = '⏳ AI 整理中...';
        this._organizeBtn.disabled = true;

        try {
            const result = await AI.organizeTasks(selectedTasks, customParentTitle);

            if (!result.groups || result.groups.length === 0) {
                alert('AI 未能识别出可归集的任务组，请重试');
                return;
            }

            // 预览整理结果
            let preview = `🤖 AI 整理结果：\n\n`;
            result.groups.forEach((group, gi) => {
                preview += `📂 ${group.parentTitle}\n`;
                preview += `   ├ 优先级：${Utils.getPriorityLabel(group.parentPriority)}\n`;
                preview += `   ├ 标签：${(group.parentTags || []).join(', ') || '无'}\n`;
                preview += `   └ 包含 ${group.children.length} 个子任务：\n`;
                group.children.forEach((child, ci) => {
                    preview += `      ${ci + 1}. ${child.title}\n`;
                });
                preview += '\n';
            });
            preview += `📝 ${result.summary || ''}`;

            const confirmAdd = confirm(`${preview}\n\n是否确认执行整理？`);
            if (!confirmAdd) return;

            // 执行整理：解绑所有选中任务（如果它们是子任务），然后创建父任务并打包
            const allChildIds = [];

            // 先解绑所有选中的子任务
            selectedTasks.forEach(t => {
                const taskObj = Store.getById(t.id);
                if (taskObj && taskObj.parentId) {
                    Store.unbindChild(t.id);
                }
            });

            // 按组创建父任务并打包
            for (const group of result.groups) {
                // 创建父任务
                const parent = Store.add({
                    title: group.parentTitle,
                    description: group.parentDescription || '',
                    priority: group.parentPriority || 'medium',
                    status: 'todo',
                    tags: group.parentTags || [],
                    isParent: true,
                    children: [],
                    boardStatus: 'pending'
                });

                // 创建子任务（保持原有标题、描述、优先级、标签）
                const childIds = [];
                for (const childData of group.children) {
                    const child = Store.add({
                        title: childData.title,
                        description: childData.description || '',
                        priority: childData.priority || 'medium',
                        status: 'todo',
                        tags: childData.tags || [],
                        parentId: parent.id,
                        boardStatus: 'pending'
                    });
                    childIds.push(child.id);
                }

                // 打包为子任务
                Store.packAsChildren(parent.id, childIds);

                // 启用卡牌堆叠
                this._saveStackMode(parent.id, true);
            }

            // 清除选中状态
            this._clearOrganizeSelection();

            alert(`✅ 整理完成！已创建 ${result.groups.length} 个父任务组，共整理 ${selectedTasks.length} 个任务`);

        } catch (err) {
            if (err instanceof AIError) {
                alert(`❌ ${err.message}`);
            } else {
                alert('❌ AI 整理失败，请稍后重试');
                console.error('Organize error:', err);
            }
        } finally {
            this._organizeBtn.textContent = '📦 AI 一键整理';
            this._organizeBtn.disabled = false;
        }
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
