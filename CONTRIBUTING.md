# EmpathyTheater 协作开发指南

## 项目简介

**共情剧场 (EmpathyTheater)** 是一个AI驱动的心理剧沙盘模拟应用，帮助用户在安全的虚拟环境中练习社交场景。

### 核心功能
- 🎭 多NPC社交场景模拟
- 🔄 角色反转模式（观察AI模仿自己）
- 🎨 像素风格场景和人物画像自动生成
- 📊 对话结束后的心理分析报告

---

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/travistoner/-.git
cd -
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
创建 `.env.local` 文件：
```env
MODELSCOPE_API_KEY=你的ModelScope_API密钥
```

> 获取API Key: https://modelscope.cn/

### 4. 启动开发服务器
```bash
npm run dev
```
访问 http://localhost:7860

---

## 项目结构

```
EmpathyTheater/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页 - 场景和NPC输入
│   │   ├── chat/page.tsx       # 聊天页 - Galgame风格UI
│   │   ├── layout.tsx          # 全局布局
│   │   ├── globals.css         # 全局样式（像素风格）
│   │   └── api/                # API路由
│   │       ├── chat/route.ts           # AI对话接口
│   │       ├── generate-image/route.ts # 图像生成接口
│   │       └── check-image/route.ts    # 图像状态查询
│   │
│   ├── components/             # React组件
│   │   ├── DialogueBox.tsx     # 底部对话框（Galgame风格）
│   │   ├── NpcPortrait.tsx     # NPC半身立绘
│   │   ├── MessageBubble.tsx   # 消息气泡
│   │   ├── ChatInput.tsx       # 输入框
│   │   ├── ReverseButton.tsx   # 角色反转按钮
│   │   └── FeedbackPanel.tsx   # 分析报告面板
│   │
│   ├── lib/                    # 工具函数
│   │   ├── prompts.ts          # AI提示词模板
│   │   └── api.ts              # API调用封装
│   │
│   └── store/                  # 状态管理
│       └── useStore.ts         # Zustand全局状态
│
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| AI对话 | ModelScope API |
| 图像生成 | Tongyi-MAI/Z-Image-Turbo |

---

## 核心概念

### NPC 数据结构
```typescript
interface NPC {
  id: string              // 唯一标识 "npc-0"
  name: string            // 名字 "小张"
  title: string           // 身份 "部门经理"
  avatar: string          // Emoji头像 "👔"
  portraitUrl: string | null      // 半身画像URL
  portraitTaskId: string | null   // 画像生成任务ID
  portraitStatus: 'idle' | 'generating' | 'completed' | 'failed'
}
```

### 消息格式
NPC发言使用特定格式：
```
[角色名] 对话内容
```
例如：
```
[小张] 你好，请坐下吧。
[王经理] 我们来聊聊这个项目。
```

### UI模式
- **Normal模式**：用户正常对话
- **Reversed模式**：AI模仿用户风格自动回复（Ctrl+R切换）

---

## 开发规范

### Git提交规范
```
feat: 新功能
fix: Bug修复
docs: 文档更新
style: 样式调整
refactor: 重构
```

### 分支策略
- `main` - 主分支，保持稳定
- `feature/*` - 功能开发分支
- `fix/*` - Bug修复分支

### 代码风格
- 使用TypeScript严格模式
- 组件使用函数式组件 + Hooks
- 样式优先使用Tailwind类名

---

## 常见开发任务

### 添加新的NPC头像映射
编辑 `src/store/useStore.ts` 中的 `getAvatarByRole` 函数：
```typescript
const roleMap: Record<string, string> = {
  '老板': '👔',
  '医生': '👨‍⚕️',
  // 添加新的映射...
}
```

### 修改AI提示词
编辑 `src/lib/prompts.ts`：
- `generateSystemPrompt` - NPC对话系统提示
- `generateReversedPrompt` - 角色反转提示
- `generateFeedbackPrompt` - 分析报告提示
- `generateNpcPortraitPrompt` - 画像生成提示

### 调整UI样式
编辑 `src/app/globals.css`：
- `.pixel-*` - 像素风格组件
- `.dialogue-*` - 对话框样式
- `.npc-portrait-*` - 立绘样式

---

## API说明

### POST /api/chat
AI对话接口，流式返回。

**请求：**
```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ]
}
```

### POST /api/generate-image
异步图像生成，返回taskId。

**请求：**
```json
{
  "prompt": "Pixel art style..."
}
```

**响应：**
```json
{
  "taskId": "xxx-xxx-xxx"
}
```

### GET /api/check-image?taskId=xxx
查询图像生成状态。

**响应：**
```json
{
  "status": "completed",
  "imageUrl": "https://..."
}
```

---

## 常见问题

### Q: 图像生成很慢？
A: Tongyi-MAI模型生成需要1-5分钟，属于正常现象。可使用"快速开始"跳过。

### Q: API报错429？
A: ModelScope API限流，请稍后重试或检查API配额。

### Q: 如何调试AI响应？
A: 打开浏览器控制台，查看 `[Portrait Poll]`、`[Image Poll]` 等日志。

---

## 联系方式

如有问题，请在GitHub Issues中提出。

---

*最后更新：2026-02-01*
