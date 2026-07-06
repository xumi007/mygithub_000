# 📋 AI 待办看板

AI 增强版的本地待办看板，基于原生 HTML + CSS + JavaScript 构建，数据存储在浏览器 localStorage 中，无需后端服务。

## ✨ 功能特性

### 📌 基础看板
- **三列看板**：待开始、进行中、已完成
- **任务管理**：新增、编辑、删除任务
- **拖拽交互**：支持跨列拖拽移动任务、同列拖拽排序
- **标签系统**：为任务添加文字标签
- **截止日期**：设置截止日期，逾期自动提醒

### 🤖 AI 增强（需配置 API）
- **文案润色**：AI 优化任务标题和描述，拆分细化子任务
- **优先级评估**：AI 自动评估任务优先级（高/中/低），配色彩标签
- **智能推荐**：根据输入的今日目标，AI 批量推荐待办清单，支持一键导入

## 🚀 快速开始

### 方式一：Live Server（推荐）
1. 使用 VS Code 安装 **Live Server** 插件
2. 右键 `index.html` → 选择 **Open with Live Server**
3. 浏览器自动打开，即可使用

### 方式二：直接打开
1. 直接在浏览器中打开 `index.html` 文件
2. 注意：部分浏览器可能限制本地文件访问 localStorage，推荐使用方式一

## ⚙️ AI 配置

1. 点击右上角 **⚙️** 按钮
2. 填入以下信息：
   - **API 地址**：你的 AI API 端点（如 OpenAI 兼容接口）
   - **API Key**：你的 API 密钥
   - **模型名称**：如 `gpt-3.5-turbo`、`gpt-4` 等
3. 点击保存即可启用 AI 功能

> 支持任何兼容 OpenAI API 格式的服务（如 OpenAI、Azure OpenAI、本地部署的模型等）

## 📁 项目结构

```
cline-practice-todo/
├── index.html              # 入口页面
├── css/
│   ├── style.css           # 全局样式
│   ├── board.css           # 看板样式
│   └── modal.css           # 弹窗样式
├── js/
│   ├── app.js              # 应用入口
│   ├── store.js            # 数据管理
│   ├── board.js            # 看板渲染
│   ├── task.js             # 任务模型
│   ├── modal.js            # 弹窗管理
│   ├── ai.js               # AI 功能
│   └── utils.js            # 工具函数
├── ai/
│   └── prompt-templates.js # AI 提示词模板
└── README.md               # 项目说明
```

## 🛠️ 技术栈

- **语言**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **存储**：浏览器 localStorage
- **AI**：兼容 OpenAI API 格式的接口
- **依赖**：零外部依赖

## 📝 开发计划

- [x] 阶段一：基础看板骨架（增删改查、三列布局）
- [ ] 阶段二：拖拽交互（跨列移动、同列排序）
- [ ] 阶段三：AI 功能集成（润色、优先级、推荐）
- [ ] 阶段四：细节打磨（响应式、动画、体验优化）

## 📄 许可

MIT License
