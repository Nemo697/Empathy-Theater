'use client'

interface FeedbackPanelProps {
  feedback: string
  onClose: () => void
  onNewSession: () => void
}

// 简单的Markdown渲染函数
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  
  lines.forEach((line, index) => {
    let content: React.ReactNode = line
    
    // 处理标题 ###
    if (line.startsWith('### ')) {
      content = (
        <h3 key={index} className="text-pixel-blue font-bold mt-4 mb-2 border-l-4 border-pixel-blue pl-2">
          {line.slice(4)}
        </h3>
      )
      elements.push(content)
      return
    }
    
    // 处理标题 ##
    if (line.startsWith('## ')) {
      content = (
        <h2 key={index} className="text-pixel-cyan font-bold mt-6 mb-3 text-base">
          {line.slice(3)}
        </h2>
      )
      elements.push(content)
      return
    }
    
    // 处理分隔线 ---
    if (line.trim() === '---') {
      elements.push(<hr key={index} className="border-gray-200 my-6" />)
      return
    }
    
    // 处理加粗 **text**
    const parts: React.ReactNode[] = []
    let remaining = line
    let partIndex = 0
    const boldRegex = /\*\*([^*]+)\*\*/g
    let match
    let lastIndex = 0
    
    while ((match = boldRegex.exec(line)) !== null) {
      // 添加匹配前的普通文本
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index))
      }
      // 添加加粗文本
      parts.push(
        <span key={`bold-${index}-${partIndex++}`} className="text-pixel-blue font-bold">
          {match[1]}
        </span>
      )
      lastIndex = match.index + match[0].length
    }
    
    // 添加剩余文本
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex))
    }
    
    if (parts.length > 0) {
      content = parts
    }
    
    // 处理列表项 - item
    if (line.startsWith('- ')) {
      elements.push(
        <div key={index} className="flex gap-2 ml-2 mb-2">
          <span className="text-pixel-blue">•</span>
          <span className="text-slate-700">{typeof content === 'string' ? content.slice(2) : parts.length > 0 ? [line.slice(0, 2), ...parts.slice(1)] : content}</span>
        </div>
      )
      return
    }
    
    // 普通段落
    elements.push(
      <p key={index} className={line.trim() === '' ? 'h-2' : ''}>
        {content}
      </p>
    )
  })
  
  return elements
}

export default function FeedbackPanel({
  feedback,
  onClose,
  onNewSession,
}: FeedbackPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="pixel-panel max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <h2 className="text-pixel-blue text-lg mb-6 text-center font-bold">
          📊 对话习惯分析报告
        </h2>
        
        <div className="text-sm leading-relaxed mb-8 text-slate-700">
          {renderMarkdown(feedback)}
        </div>
        
        <div className="flex gap-3 justify-center">
          <button
            className="pixel-btn pixel-btn-purple text-sm py-2 px-4"
            onClick={onClose}
          >
            继续对话
          </button>
          <button
            className="pixel-btn pixel-btn-gold text-sm py-2 px-4"
            onClick={onNewSession}
          >
            新场景
          </button>
        </div>
        
        <p className="text-center text-xs text-gray-500 mt-4">
          每一次对话都是自我发现的旅程 ✨
        </p>
      </div>
    </div>
  )
}
