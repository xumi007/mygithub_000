/* ============================================
   ModalSettings - AI 设置弹窗管理
   ============================================ */

const ModalSettings = {
    /** DOM 引用 */
    modal: null,
    overlay: null,
    btnClose: null,
    btnCancel: null,
    btnSave: null,
    inputEndpoint: null,
    inputApiKey: null,
    selectModel: null,

    /** 内置模型列表 */
    BUILTIN_MODELS: [
        'deepseek-v4-flash',
        'deepseek-v4-pro',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-3.5-turbo',
        'claude-3.5-haiku',
        'claude-3-sonnet',
        'gemini-2.0-flash'
    ],

    /** DeepSeek 官方 OpenAI 兼容地址 */
    DEEPSEEK_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',

    /**
     * 初始化
     */
    init() {
        this.modal = document.getElementById('modalSettings');
        this.overlay = document.getElementById('overlay');
        this.btnClose = document.getElementById('btnCloseSettings');
        this.btnCancel = document.getElementById('btnCancelSettings');
        this.btnSave = document.getElementById('btnSaveSettings');
        this.inputEndpoint = document.getElementById('aiApiEndpoint');
        this.inputApiKey = document.getElementById('aiApiKey');
        this.selectModel = document.getElementById('aiModel');

        this._bindEvents();
    },

    /**
     * 绑定事件
     */
    _bindEvents() {
        this.btnClose.addEventListener('click', () => this.close());
        this.btnCancel.addEventListener('click', () => this.close());
        this.btnSave.addEventListener('click', () => this._handleSave());

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

        // 模型下拉切换 → 自动填充 API 地址
        this.selectModel.addEventListener('change', () => this._onModelChange());
    },

    /**
     * 模型下拉切换事件
     * 选中 deepseek 系列时自动填充官方 OpenAI 兼容地址
     */
    _onModelChange() {
        const model = this.selectModel.value;

        // 判断是否为 deepseek 系列模型
        if (model.startsWith('deepseek-')) {
            // 仅当 API 地址为空或当前地址与 deepseek 地址不同时才自动填充
            const currentEndpoint = this.inputEndpoint.value.trim();
            if (!currentEndpoint || currentEndpoint !== this.DEEPSEEK_ENDPOINT) {
                this.inputEndpoint.value = this.DEEPSEEK_ENDPOINT;
            }
        }
        // 其他模型不自动改动地址，留给用户自主配置
    },

    /**
     * 打开设置弹窗
     * 自动匹配已保存的模型到下拉选中项
     */
    open() {
        // 加载当前配置
        const config = AI.getConfig();
        this.inputEndpoint.value = config.endpoint || '';
        this.inputApiKey.value = config.apiKey || '';

        // 自动匹配已保存的模型
        const savedModel = config.model || 'gpt-3.5-turbo';
        this._selectModelValue(savedModel);

        this.modal.classList.remove('hidden');
        this.overlay.classList.remove('hidden');
        this.inputEndpoint.focus();
    },

    /**
     * 选中下拉框中匹配的模型值
     * 如果已保存的模型不在内置列表中，动态添加一个 option 并选中
     * @param {string} modelValue
     */
    _selectModelValue(modelValue) {
        // 先尝试直接匹配
        const options = this.selectModel.options;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value === modelValue) {
                this.selectModel.selectedIndex = i;
                return;
            }
        }

        // 不在列表中：动态添加 option 并选中
        const option = document.createElement('option');
        option.value = modelValue;
        option.textContent = modelValue;
        option.selected = true;
        this.selectModel.appendChild(option);
    },

    /**
     * 关闭设置弹窗
     */
    close() {
        this.modal.classList.add('hidden');
        this.overlay.classList.add('hidden');
    },

    /**
     * 保存设置
     */
    _handleSave() {
        const endpoint = this.inputEndpoint.value.trim();
        const apiKey = this.inputApiKey.value.trim();
        const model = this.selectModel.value.trim() || 'gpt-3.5-turbo';

        if (!endpoint) {
            alert('请输入 API 地址');
            this.inputEndpoint.focus();
            return;
        }

        if (!apiKey) {
            alert('请输入 API 密钥');
            this.inputApiKey.focus();
            return;
        }

        // 验证 URL 格式
        try {
            new URL(endpoint);
        } catch {
            alert('API 地址格式不正确，请输入有效的 URL');
            this.inputEndpoint.focus();
            return;
        }

        AI.updateConfig({ endpoint, apiKey, model });
        alert('✅ AI 配置已保存');
        this.close();
    }
};
