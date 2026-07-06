/* ============================================
   Prompt Templates - AI 提示词模板
   ============================================ */

const PromptTemplates = {
    /**
     * 任务润色与子任务拆分
     * @param {string} title 原始标题
     * @param {string} description 原始描述
     */
    polish(title, description) {
        return {
            system: `你是一个专业的任务管理助手。你的职责是：
1. 优化用户输入的任务标题，使其更清晰、具体、可执行
2. 如果用户提供了描述，对描述进行润色，使其更有条理
3. 将大任务拆分为 2-5 个可执行的子任务

请以 JSON 格式回复，格式如下：
{
  "polishedTitle": "优化后的标题",
  "polishedDescription": "优化后的描述（如果没有描述则返回空字符串）",
  "subtasks": ["子任务1", "子任务2", ...]
}`,
            user: `请优化以下任务：
标题：${title}
描述：${description || '（无描述）'}`
        };
    },

    /**
     * 优先级评估
     * @param {Object} task 任务对象
     */
    evaluatePriority(task) {
        return {
            system: `你是一个任务优先级评估专家。请根据任务的内容、截止日期等信息，评估该任务的优先级。

评估标准：
- high（高优先级）：紧急重要、有明确截止日期、对目标有重大影响
- medium（中优先级）：重要但不紧急、常规工作
- low（低优先级）：琐事、可以推迟、没有时间压力

请以 JSON 格式回复，格式如下：
{
  "priority": "high|medium|low",
  "reason": "评估理由（简短说明）"
}`,
            user: `请评估以下任务的优先级：
标题：${task.title}
描述：${task.description || '（无描述）'}
截止日期：${task.dueDate || '（无截止日期）'}
标签：${(task.tags || []).join(', ') || '（无标签）'}`
        };
    },

    /**
     * 根据目标推荐待办清单（扁平结构）
     * @param {string} goal 用户输入的目标
     */
    recommendTasks(goal) {
        return {
            system: `你是一个高效的任务规划助手。根据用户描述的目标或需求，推荐 3-8 个具体的待办任务。

要求：
1. 每个任务必须有标题和简要描述
2. 为每个任务评估优先级（high/medium/low）
3. 任务要具体、可执行，避免过于笼统
4. 任务之间要有逻辑顺序
5. 为每个任务自动判别分类（category）：学习相关（背单词、高数、编程学习等）归为 study，日常事务（逛街、购物、家务等）归为 daily
6. 根据所有任务的语义，整体预判这批任务应归属哪个板块（daily/study），并给出置信度（0~1 之间的小数）

请以 JSON 格式回复，格式如下：
{
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务描述",
      "priority": "high|medium|low",
      "tags": ["标签1", "标签2"],
      "category": "daily|study"
    }
  ],
  "predictedCategory": "daily|study",
  "confidence": 0.95,
  "summary": "对推荐清单的简要说明"
}`,
            user: `我的今日目标/需求是：${goal}

请为我推荐一份待办清单。`
        };
    },

    /**
     * 根据目标推荐待办清单（父子结构，自动堆叠）
     * @param {string} goal 用户输入的目标
     * @param {string} parentTitle 父任务标题
     */
    recommendTasksWithStack(goal, parentTitle) {
        return {
            system: `你是一个高效的任务规划助手。根据用户描述的目标或需求，生成一个父任务及其子任务清单。

要求：
1. 父任务标题为「${parentTitle}」，请为父任务评估整体优先级（high/medium/low）和整体标签
2. 将目标拆分为 3-8 个具体的、可执行的子任务
3. 每个子任务必须有标题和简要描述
4. 为每个子任务评估优先级（high/medium/low）
5. 子任务之间要有逻辑顺序
6. 子任务要具体、可执行，避免过于笼统
7. 根据所有子任务的语义，整体预判这批任务应归属哪个板块（daily/study），并给出置信度（0~1 之间的小数）

请严格以 JSON 格式回复，格式如下：
{
  "parent": {
    "title": "${parentTitle}",
    "description": "父任务的整体描述",
    "priority": "high|medium|low",
    "tags": ["标签1", "标签2"]
  },
  "children": [
    {
      "title": "子任务标题",
      "description": "子任务描述",
      "priority": "high|medium|low",
      "tags": ["标签1", "标签2"]
    }
  ],
  "predictedCategory": "daily|study",
  "confidence": 0.95,
  "summary": "对推荐清单的简要说明"
}`,
            user: `我的今日目标/需求是：${goal}

请为我生成父子结构的待办清单，父任务为「${parentTitle}」，子任务为具体执行步骤。`
        };
    },

    /**
     * AI 一键归集整理：分析选中任务，自动合并同主题任务生成父任务
     * @param {Array} tasks 选中的任务列表 [{title, description, tags, priority}]
     * @param {string} customParentTitle 用户自定义父任务标题（可选）
     */
    organizeTasks(tasks, customParentTitle) {
        const taskList = tasks.map((t, i) =>
            `任务${i + 1}：标题="${t.title}"，描述="${t.description || ''}"，标签=[${(t.tags || []).join(', ')}]`
        ).join('\n');

        const parentTitleHint = customParentTitle
            ? `父任务标题已指定为「${customParentTitle}」，请以此为准。`
            : `请根据任务语义自动生成一个合适的父任务标题（例如：今日学习计划、项目开发任务等）。`;

        return {
            system: `你是一个智能任务整理助手。你的职责是分析用户选中的多个任务，自动合并同主题任务生成父任务。

${parentTitleHint}

要求：
1. 分析所有选中任务的标题、描述、标签的语义相似度
2. 将同主题的任务归集到同一个父任务下
3. 为父任务生成整体描述（概括这些任务的共同目标）
4. 为父任务评估整体优先级（high/medium/low）
5. 为父任务生成统一的标签（从子任务标签中提取共同点）
6. 子任务保持原有的标题、描述、优先级、标签不变
7. 如果选中任务语义差异过大无法归集，请按主题拆分为多个父任务组

请严格以 JSON 格式回复，格式如下：
{
  "groups": [
    {
      "parentTitle": "父任务标题",
      "parentDescription": "父任务整体描述",
      "parentPriority": "high|medium|low",
      "parentTags": ["标签1", "标签2"],
      "children": [
        {
          "title": "原任务标题",
          "description": "原任务描述",
          "priority": "high|medium|low",
          "tags": ["标签1"]
        }
      ]
    }
  ],
  "summary": "对整理结果的简要说明"
}`,
            user: `以下是我选中的任务列表，请帮我分析并归集为父子结构：\n\n${taskList}`
        };
    }
};
