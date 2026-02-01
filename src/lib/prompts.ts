import { UserPersona, NPC } from '@/store/useStore'

export function generateSystemPrompt(sceneDescription: string, roleDetails: string, npcs: NPC[] = []): string {
  const npcList = npcs.length > 0 
    ? npcs.map(n => `- ${n.name}（${n.title}）`).join('\n')
    : '- 根据场景自动生成角色'
  
  const npcNames = npcs.map(n => n.name).join('、')
  
  return `你是"共情剧场"的AI主持人，一个专业的心理剧引导者。

## 你的角色
你同时扮演场景中的所有NPC角色，通过沉浸式对话帮助用户探索社交场景。

## 当前场景
${sceneDescription}

## 场景中的NPC角色（共${npcs.length}人）
${npcList}

## 角色设定
${roleDetails || '根据场景自然扮演各角色，每个角色保持独特且一致的个性。'}

## 行为准则
1. **智能发言判断**：
   - 如果用户话语明显未说完（如语句不完整、有省略号暗示还要继续），选择沉默等待
   - 不是每句话都需要立即回应，根据对话节奏自然决定
   - 如果某个角色没有合适的回应，该角色可以选择沉默
   - 每次回复时，让0-2个NPC发言，其他角色可以保持沉默
2. **沉默表达方式**：
   - 当角色选择沉默时，使用格式：[角色名] [SILENCE]
   - 可以全部角色沉默，也可以部分沉默
   - 沉默是一种有力的社交反馈，合理使用
3. 每个角色保持独特的说话风格和性格
4. 回复长度每人控制在20-50字，使用自然口语
5. 适当制造一些挑战，帮助用户练习应对
6. 如果内容敏感，温和重定向到安全话题

## 重要：响应格式
每次回复必须以角色名字开头，格式为：[角色名] 对话内容

多个角色发言时，每人一行：
[${npcs[0]?.name || '角色A'}] 这是第一个角色说的话。
[${npcs[1]?.name || '角色B'}] 这是第二个角色的回应。

沉默时的格式：
[${npcs[0]?.name || '角色A'}] [SILENCE]

注意：
- 不要每次都让所有角色说话，轮流出场更自然
- 根据对话情境决定谁应该发言、谁应该沉默
- 保持每个角色的独特性格和说话方式`
}

export function generateReversedPrompt(
  sceneDescription: string,
  roleDetails: string,
  userPersona: UserPersona,
  recentUserMessages: string[],
  npcs: NPC[] = []
): string {
  const npcList = npcs.length > 0 
    ? npcs.map(n => `- ${n.name}（${n.title}）`).join('\n')
    : ''

  return `你是"共情剧场"的AI，现在你需要接管用户的角色，模仿他们的说话风格继续对话。

## 当前场景
${sceneDescription}

${npcList ? `## 场景中的NPC角色\n${npcList}\n` : ''}

## 用户语言风格分析
- 平均回复长度：约${userPersona.averageLength}字
- 常用表达：${userPersona.commonPhrases.join('、')}
- 语气风格：${userPersona.tone === 'formal' ? '正式' : userPersona.tone === 'nervous' ? '紧张犹豫' : '随意'}
- 语气词/填充词：${userPersona.fillerWords.join('、')}

## 用户最近的发言示例
${recentUserMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

## 任务要求
1. **完全模仿用户的说话方式**：用词习惯、句式、语气
2. 回复长度接近用户平均水平（${userPersona.averageLength}字左右）
3. 使用用户的常用表达和语气词
4. 保持用户的情绪模式
5. **不要改进或美化表达**，要像用户本人一样说话
6. 如果用户表达犹豫，你也要犹豫；如果用户喜欢用"嗯"，你也多用

## 响应格式
直接以用户的身份和风格回复，不要加任何解释。就像用户本人在说话一样。`
}

export function generateNPCResponsePrompt(
  sceneDescription: string,
  roleDetails: string,
  lastUserMessage: string
): string {
  return `${generateSystemPrompt(sceneDescription, roleDetails)}

用户刚才说："${lastUserMessage}"

请以NPC身份自然回应。`
}

export function generateFeedbackPrompt(
  messages: Array<{ role: string; content: string }>,
  userPersona: UserPersona | null
): string {
  const chatHistory = messages
    .filter(m => m.role === 'user' || m.role === 'npc' || m.role === 'reversed-user')
    .map(m => {
      if (m.role === 'user') return `用户: ${m.content}`
      if (m.role === 'reversed-user') return `AI模拟用户: ${m.content}`
      return `NPC: ${m.content}`
    })
    .join('\n')

  const userMessages = messages.filter(m => m.role === 'user')
  const messageCount = userMessages.length
  const totalLength = userMessages.reduce((sum, m) => sum + m.content.length, 0)
  const avgLength = messageCount > 0 ? Math.round(totalLength / messageCount) : 0

  return `你是一位专业的心理咨询师和沟通分析专家。请根据以下社交模拟对话，生成一份深度用户对话习惯分析报告。

## 对话记录
${chatHistory}

## 基础数据统计
- 用户发言次数：${messageCount}次
- 用户平均发言长度：${avgLength}字
${userPersona ? `
## 用户语言特征（系统检测）
- 常用表达：${userPersona.commonPhrases.join('、') || '无明显特征'}
- 语气风格：${userPersona.tone === 'formal' ? '正式拘谨' : userPersona.tone === 'nervous' ? '紧张犹豫' : '轻松随意'}
- 填充词习惯：${userPersona.fillerWords.join('、') || '无'}
` : ''}

## 请生成深度分析报告，包含以下部分：

### 📊 对话习惯分析
分析用户的对话模式，包括：
- 回复速度与节奏感（是否急于回应/倾向深思后回复）
- 话语长度偏好（简洁/详细）
- 主动性程度（主导话题/跟随他人）
- 表达方式特点（直接/委婉/试探性）

### 🧠 潜在心理剖析
基于对话内容和方式，分析用户可能的：
- 社交焦虑程度（是否有回避、紧张、过度迎合等表现）
- 自我认知倾向（自信/自我怀疑/过度谦虚）
- 人际边界意识（是否能恰当表达需求和拒绝）
- 情绪调节能力（面对压力/挑战时的应对方式）
- 深层需求（被认可/被理解/安全感/掌控感等）

### 💡 沟通亮点
列出2-3个具体的沟通优势，引用对话原文举例

### 🎯 改进建议
针对发现的问题，给出2-3个具体可操作的建议，包括：
- 具体场景示例
- 改进后的话术对比

### 🌱 成长方向
一段50-80字的温暖寄语，指出用户的潜力和成长方向

---
注意事项：
1. 分析要基于对话内容，有理有据
2. 语气温暖、包容、非评判性
3. 心理分析要专业但易懂，避免过度病理化
4. 建议要具体、可执行
5. 直接输出报告，不要加开头问候语`
}

export function generateImagePrompt(sceneDescription: string): string {
  return `Pixel art style illustration of a social scene: ${sceneDescription}. 
8-bit retro game aesthetic, warm colors, cozy atmosphere, 
no people or characters, only environment and background elements, 
suitable as chat background, high quality pixel art, 
limited color palette, nostalgic gaming style.`
}

// 生成NPC半身画像的提示词
export function generateNpcPortraitPrompt(name: string, title: string): string {
  // 根据身份映射外观特征
  const getAppearanceByTitle = (title: string): string => {
    const titleLower = title.toLowerCase()
    
    if (titleLower.includes('老板') || titleLower.includes('经理') || titleLower.includes('领导') || titleLower.includes('总监')) {
      return 'wearing formal business suit, confident expression, mature appearance'
    }
    if (titleLower.includes('医生') || titleLower.includes('护士')) {
      return 'wearing white medical coat, professional and caring expression'
    }
    if (titleLower.includes('老师') || titleLower.includes('教授') || titleLower.includes('导师')) {
      return 'wearing glasses, scholarly appearance, wise expression'
    }
    if (titleLower.includes('学生') || titleLower.includes('同学')) {
      return 'young appearance, school uniform or casual clothes, energetic expression'
    }
    if (titleLower.includes('服务员') || titleLower.includes('店员')) {
      return 'wearing service uniform, friendly smile, approachable appearance'
    }
    if (titleLower.includes('面试官') || titleLower.includes('HR')) {
      return 'formal attire, evaluating expression, professional demeanor'
    }
    if (titleLower.includes('朋友') || titleLower.includes('闺蜜') || titleLower.includes('哥们')) {
      return 'casual clothes, warm smile, friendly appearance'
    }
    if (titleLower.includes('家人') || titleLower.includes('父') || titleLower.includes('母') || titleLower.includes('爸') || titleLower.includes('妈')) {
      return 'warm expression, caring appearance, family-like demeanor'
    }
    if (titleLower.includes('恋人') || titleLower.includes('对象') || titleLower.includes('男友') || titleLower.includes('女友')) {
      return 'attractive appearance, gentle expression, romantic vibe'
    }
    if (titleLower.includes('客户') || titleLower.includes('顾客')) {
      return 'business casual attire, expectant expression'
    }
    if (titleLower.includes('同事')) {
      return 'office casual attire, collegial expression'
    }
    
    return 'appropriate attire for the role, natural expression'
  }
  
  const appearance = getAppearanceByTitle(title)
  
  return `Pixel art character portrait, half-body shot from chest up, centered composition.
Character: ${name}, role: ${title}.
Appearance: ${appearance}.
Style: 8-bit retro game aesthetic, limited color palette (16-32 colors), 
clean pixel art, suitable for visual novel game character sprite.
Background: solid light background (e.g., pale green, soft cream, or off-white) to match the new fresh aesthetic.
Quality: high detail pixel art, clear silhouette, expressive face.
DO NOT include any text or labels in the image.`
}

// 生成NPC角色的提示词
export function generateNPCsPrompt(sceneDescription: string, roleDetails: string): string {
  return `根据以下场景，生成2-4个NPC角色。每个角色需要有名字和身份。

## 场景描述
${sceneDescription}

## 角色设定参考
${roleDetails || '无特别说明'}

## 输出格式要求
请严格按以下JSON格式输出，不要加任何其他文字：
[
  {"name": "小张", "title": "学生会会长"},
  {"name": "王经理", "title": "部门经理"}
]

注意：
1. 名字要简短自然（如：小张、王经理、李老师）
2. 身份要具体明确（如：学生会会长、部门经理、面试官）
3. 角色数量2-4个
4. 只输出JSON数组，不要其他内容`
}
