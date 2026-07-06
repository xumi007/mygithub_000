/* ============================================
   App - 应用入口，初始化所有模块
   ============================================ */

const App = {
    /**
     * 应用初始化
     */
    init() {
        console.log('🚀 AI 待办看板启动中...');

        // 1. 初始化数据层
        Store.init();
        console.log('✅ Store 初始化完成');

        // 2. 初始化看板（会自动注册 Store 监听）
        Board.init();
        console.log('✅ Board 初始化完成');

        // 3. 初始化弹窗
        Modal.init();
        console.log('✅ Modal 初始化完成');

        // 4. 初始化 AI 设置弹窗
        ModalSettings.init();
        console.log('✅ ModalSettings 初始化完成');

        // 5. 初始化 AI 推荐弹窗
        ModalAiRecommend.init();
        console.log('✅ ModalAiRecommend 初始化完成');

        // 5.5 初始化 AI 分类确认弹窗
        ModalCategoryConfirm.init();
        console.log('✅ ModalCategoryConfirm 初始化完成');

        // 6. 初始化 AI 模块
        AI.init();
        console.log('✅ AI 模块初始化完成');

        console.log('🎉 AI 待办看板启动成功！');
    }
};

// DOM 加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
