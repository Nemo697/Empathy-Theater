# EmpathyTheater 项目需求文档

## 环境要求

| 项目 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.x | 20.x+ |
| npm | 9.x | 10.x+ |

## 依赖清单

### 生产依赖 (dependencies)

| 包名 | 版本 | 说明 |
|------|------|------|
| next | ^14.2.35 | React全栈框架 |
| react | ^18.3.1 | UI库 |
| react-dom | ^18.3.1 | React DOM渲染 |
| zustand | ^5.0.10 | 轻量级状态管理 |
| @tailwindcss/postcss | ^4.1.18 | Tailwind CSS PostCSS插件 |

### 开发依赖 (devDependencies)

| 包名 | 版本 | 说明 |
|------|------|------|
| typescript | ^5.9.3 | TypeScript编译器 |
| @types/node | ^25.1.0 | Node.js类型定义 |
| @types/react | ^19.2.10 | React类型定义 |
| @types/react-dom | ^19.2.3 | React DOM类型定义 |
| tailwindcss | ^4.1.18 | CSS框架 |
| postcss | ^8.5.6 | CSS处理工具 |
| autoprefixer | ^10.4.23 | CSS自动前缀 |
| eslint | ^9.39.2 | 代码检查工具 |
| eslint-config-next | ^16.1.6 | Next.js ESLint配置 |

## 外部API依赖

| 服务 | 用途 | 环境变量 |
|------|------|----------|
| ModelScope API | AI对话生成 | `MODELSCOPE_API_KEY` |
| ModelScope API | 图像生成 (Tongyi-MAI/Z-Image-Turbo) | `MODELSCOPE_API_KEY` |

## 环境变量配置

创建 `.env.local` 文件：

```env
MODELSCOPE_API_KEY=your_api_key_here
```

## 安装与运行

```bash
# 安装依赖
npm install

# 开发模式 (http://localhost:7860)
npm run dev

# 生产构建
npm run build

# 生产运行
npm run start
```

## 端口配置

- 开发模式：`0.0.0.0:7860`
- 生产模式：`0.0.0.0:7860`

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
