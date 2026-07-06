/* ============================================
   Modal - 弹窗管理
   ============================================ */

const Modal = {
    /** 当前编辑的任务 ID（编辑模式时） */
    _editingTaskId: null,

    /** 是否正在编辑模式 */
    get _isEditing() {
        return this._editingTaskId !== null;
    },

    /**
     * 初始化弹窗模块
     */
    init() {
        // DOM 引用
        this.overlay = document.getElementById('overlay');
        this.taskModal = document.getElementById('modalTask');
        this.taskModalTitle = document.getElementById('modalTaskTitle');
        this.formTask = document.getElementById('formTask');
        this.btnSaveTask = document.getElementById('btnSaveTask');
        this.btnCancelTask = document.getElementById('btnCancelTask');
        this.btnCloseTaskModal = document.getElementById('btnCloseTaskModal');

        // 表单字段
        this.taskId = document.getElementById('taskId');
        this.taskTitle = document.getElementById('taskTitle');
        this.taskDescription = document.getElementById('taskDescription');
        this.taskPriority = document.getElementById('taskPriority');
        this.taskDueDate = document.getElementById('taskDueDate');
        this.taskTags = document.getElementById('taskTags');
        this.taskStatus = document.getElementById('taskStatus');

        // 绑定事件
        this._bindEvents();

        // 设置 Board 的回调
        Board.setEditHandler((task) => this.openEdit(task));
        Board.setDeleteHandler((task) => this._confirmDelete(task));
    },

    /**
     * 绑定事件
     */
    _bindEvents() {
        // 新增按钮
        document.getElementById('btnAddTask').addEventListener('click', () => this.openAdd());

        // 保存按钮
        this.btnSaveTask.addEventListener('click', () => this._handleSave());

        // 取消按钮
        this.btnCancelTask.addEventListener('click', () => this.close());
        this.btnCloseTaskModal.addEventListener('click', () => this.close());

        // 点击遮罩层关闭
        this.overlay.addEventListener('click', () => this.close());

        // 键盘 ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.taskModal.classList.contains('hidden')) {
                this.close();
            }
        });

        // 表单回车提交
        this.taskTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleSave();
            }
        });
    },

    /**
     * 打开新增任务弹窗
     */
    openAdd() {
        this._editingTaskId = null;
        this.taskModalTitle.textContent = '新增任务';
        this.btnSaveTask.textContent = '创建任务';
        this._resetForm();
        this._show();
        this.taskTitle.focus();
    },

    /**
     * 打开编辑任务弹窗
     * @param {Object} task
     */
    openEdit(task) {
        this._editingTaskId = task.id;
        this.taskModalTitle.textContent = '编辑任务';
        this.btnSaveTask.textContent = '保存修改';

        // 填充表单
        const formData = Task.toForm(task);
        this.taskId.value = formData.id;
        this.taskTitle.value = formData.title;
        this.taskDescription.value = formData.description;
        this.taskPriority.value = formData.priority;
        this.taskDueDate.value = formData.dueDate;
        this.taskTags.value = formData.tags;
        this.taskStatus.value = formData.status;

        this._show();
        this.taskTitle.focus();
    },

    /**
     * 关闭弹窗
     */
    close() {
        this.taskModal.classList.add('hidden');
        this.overlay.classList.add('hidden');
        this._editingTaskId = null;
    },

    /**
     * 显示弹窗
     */
    _show() {
        this.taskModal.classList.remove('hidden');
        this.overlay.classList.remove('hidden');
    },

    /**
     * 重置表单
     */
    _resetForm() {
        this.taskId.value = '';
        this.taskTitle.value = '';
        this.taskDescription.value = '';
        this.taskPriority.value = 'medium';
        this.taskDueDate.value = '';
        this.taskTags.value = '';
        this.taskStatus.value = 'todo';
    },

    /**
     * 收集表单数据
     */
    _getFormData() {
        return {
            title: this.taskTitle.value,
            description: this.taskDescription.value,
            priority: this.taskPriority.value,
            dueDate: this.taskDueDate.value,
            tags: this.taskTags.value,
            status: this.taskStatus.value
        };
    },

    /**
     * 处理保存
     */
    _handleSave() {
        const rawData = this._getFormData();
        const taskData = Task.fromForm(rawData);

        // 校验
        const validation = Task.validate(taskData);
        if (!validation.valid) {
            alert(validation.errors.join('\n'));
            return;
        }

        if (this._isEditing) {
            // 更新任务
            Store.update(this._editingTaskId, taskData);
        } else {
            // 新增任务
            Store.add(taskData);
        }

        this.close();
    },

    /**
     * 确认删除
     * 如果是父任务且有子任务，使用递归删除（连带清除未解绑的子任务）
     * 如果是普通任务或子任务，使用普通删除
     * @param {Object} task
     */
    _confirmDelete(task) {
        if (confirm(`确定要删除任务「${task.title}」吗？`)) {
            // 判断是否为父任务且有子任务
            const children = Store.getChildren(task.id);
            if (task.isParent && children.length > 0) {
                Store.removeParentRecursively(task.id);
            } else {
                Store.delete(task.id);
            }
        }
    }
};
