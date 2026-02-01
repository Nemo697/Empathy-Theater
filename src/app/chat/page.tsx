'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useStore, Message, getAvatarByRole, NPC } from '@/store/useStore'
import { 
  generateSystemPrompt, 
  generateReversedPrompt, 
  generateFeedbackPrompt
} from '@/lib/prompts'
import MessageBubble from '@/components/MessageBubble'
import ChatInput from '@/components/ChatInput'
import ReverseButton from '@/components/ReverseButton'
import FeedbackPanel from '@/components/FeedbackPanel'
import NpcPortrait from '@/components/NpcPortrait'
import DialogueBox from '@/components/DialogueBox'

export default function ChatPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [imageProgress, setImageProgress] = useState(0)
  const [typingNpc, setTypingNpc] = useState<string | null>(null)  // 当前正在输入的NPC名称
  const [showHistory, setShowHistory] = useState(false)  // 对话历史面板显示状态
  const [displayIndex, setDisplayIndex] = useState(0)  // 当前显示的消息索引
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)  // 是否正在自动播放消息队列
  const greetingSent = useRef(false)
  const npcsInitialized = useRef(false)
  
  const {
    sceneDescription,
    roleDetails,
    backgroundImage,
    imageTaskId,
    imageStatus,
    messages,
    isTyping,
    mode,
    userPersona,
    showFeedback,
    feedback,
    npcs,
    currentSpeakerId,
    setBackgroundImage,
    setImageStatus,
    setNpcs,
    updateNpcPortrait,
    setNpcPortraitStatus,
    setCurrentSpeaker,
    addMessage,
    updateMessage,
    finalizeMessage,
    setTyping,
    toggleMode,
    setFeedback,
    setShowFeedback,
    setLoading,
    reset,
  } = useStore()

  // Redirect if no scene
  useEffect(() => {
    if (!sceneDescription) {
      router.push('/')
    }
  }, [sceneDescription, router])

  // Poll for image status
  useEffect(() => {
    if (!imageTaskId || imageStatus !== 'generating') return

    let pollCount = 0
    setImageProgress(0)

    const pollInterval = setInterval(async () => {
      try {
        pollCount++
        // Max 300 polls (900 seconds = 15 minutes), progress from 0 to 90%
        const progress = Math.min(90, Math.floor((pollCount / 300) * 95))
        setImageProgress(progress)

        const response = await fetch(`/api/check-image?taskId=${imageTaskId}`)
        const data = await response.json()

        console.log('[Image Poll]', pollCount, data)

        if (data.status === 'completed' && data.imageUrl) {
          setImageProgress(100)
          setBackgroundImage(data.imageUrl)
          setImageStatus('completed')
          clearInterval(pollInterval)
        } else if (data.status === 'failed') {
          setImageStatus('failed')
          clearInterval(pollInterval)
        }
        // Keep polling if still pending
      } catch (error) {
        console.error('Poll error:', error)
      }
    }, 3000)

    // Clean up and timeout after 15 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval)
      setImageProgress(0)
      setImageStatus('failed')
      console.log('[Image] Generation timeout after 15 minutes')
    }, 900000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [imageTaskId, imageStatus, setBackgroundImage, setImageStatus])

  // Poll for NPC portrait status
  useEffect(() => {
    const generatingNpcs = npcs.filter(npc => npc.portraitStatus === 'generating' && npc.portraitTaskId)
    if (generatingNpcs.length === 0) return

    const pollIntervals: NodeJS.Timeout[] = []
    const timeouts: NodeJS.Timeout[] = []

    generatingNpcs.forEach((npc) => {
      let pollCount = 0

      const pollInterval = setInterval(async () => {
        try {
          pollCount++
          const response = await fetch(`/api/check-image?taskId=${npc.portraitTaskId}`)
          const data = await response.json()

          console.log(`[Portrait Poll] ${npc.name}`, pollCount, data.status)

          if (data.status === 'completed' && data.imageUrl) {
            updateNpcPortrait(npc.id, data.imageUrl)
            clearInterval(pollInterval)
          } else if (data.status === 'failed') {
            setNpcPortraitStatus(npc.id, 'failed')
            clearInterval(pollInterval)
          }
        } catch (error) {
          console.error(`Portrait poll error for ${npc.name}:`, error)
        }
      }, 3000)

      pollIntervals.push(pollInterval)

      // Timeout after 15 minutes
      const timeout = setTimeout(() => {
        clearInterval(pollInterval)
        setNpcPortraitStatus(npc.id, 'failed')
        console.log(`[Portrait] ${npc.name} generation timeout`)
      }, 900000)

      timeouts.push(timeout)
    })

    return () => {
      pollIntervals.forEach(clearInterval)
      timeouts.forEach(clearTimeout)
    }
  }, [npcs, updateNpcPortrait, setNpcPortraitStatus])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 消息队列播放 - 点击切换到下一条消息
  useEffect(() => {
    // 如果没有消息，重置
    if (messages.length === 0) {
      setDisplayIndex(0)
      setIsAutoPlaying(false)
      return
    }

    // 如果正在输入，显示最新消息
    if (isTyping) {
      setDisplayIndex(messages.length - 1)
      setIsAutoPlaying(false)
      return
    }

    // 如果displayIndex已经是最后一条消息，停止等待点击
    if (displayIndex >= messages.length - 1) {
      setDisplayIndex(messages.length - 1)
      setIsAutoPlaying(false)
      return
    }

    // 有未显示的消息，等待用户点击
    setIsAutoPlaying(true)
  }, [displayIndex, messages.length, isTyping])

  // 点击对话框跳到下一条消息
  const handleDialogueClick = () => {
    if (displayIndex < messages.length - 1 && !isTyping) {
      setDisplayIndex(prev => prev + 1)
    }
  }

  // Initial NPC greeting
  useEffect(() => {
    if (sceneDescription && messages.length === 0 && !greetingSent.current) {
      greetingSent.current = true
      sendInitialGreeting()
    }
  }, [sceneDescription])

  const streamResponse = async (
    apiMessages: Array<{ role: string; content: string }>,
    onChunk: (content: string) => void
  ): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `API错误: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              fullContent += content
              onChunk(fullContent)
            }
          } catch {}
        }
      }
    }

    return fullContent
  }

  // 解析多NPC消息并拆分为独立消息，支持沉默标记
  const splitNpcMessages = (content: string) => {
    // 匹配所有 [角色名] 内容 的格式
    const pattern = /\[([^\]]+)\]\s*([^\[]*)/g
    const matches: Array<{ name: string; content: string; isSilence: boolean }> = []
    let match
    
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim()
      const text = match[2].trim()
      
      // 检测是否为沉默标记
      const isSilence = text.toUpperCase() === '[SILENCE]'
      
      if (isSilence) {
        // 沉默消息也要添加
        matches.push({ name, content: '[SILENCE]', isSilence: true })
      } else if (text) {
        // 普通对话内容
        matches.push({ name, content: text, isSilence: false })
      }
    }
    
    return matches
  }

  // 处理NPC响应完成后的消息拆分
  const finalizeNpcResponse = () => {
    const state = useStore.getState()
    const lastMessage = state.messages[state.messages.length - 1]
    
    if (lastMessage?.role === 'npc' && lastMessage.content) {
      const splits = splitNpcMessages(lastMessage.content)
      
      if (splits.length > 1) {
        // 有多个NPC发言/沉默，拆分为独立消息
        const newMessages = state.messages.slice(0, -1)
        splits.forEach((split) => {
          const displayContent = split.isSilence 
            ? `[${split.name}] ......（沉默）`
            : `[${split.name}] ${split.content}`
          
          newMessages.push({
            id: Math.random().toString(36).substring(2, 9),
            role: 'npc',
            content: displayContent,
            timestamp: Date.now(),
            isStreaming: false,
          })
        })
        useStore.setState({ messages: newMessages })
      } else if (splits.length === 1) {
        // 单个NPC响应
        const split = splits[0]
        const displayContent = split.isSilence
          ? `[${split.name}] ......（沉默）`
          : lastMessage.content
        
        useStore.setState((state) => ({
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, content: displayContent, isStreaming: false }
              : msg
          ),
        }))
      } else {
        // 没有匹配到任何格式，保持原样
        useStore.setState((state) => ({
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, isStreaming: false }
              : msg
          ),
        }))
      }
    }
    setTypingNpc(null)
  }

  const sendInitialGreeting = async () => {
    setTyping(true)
    setError(null)
    setTypingNpc('生成中...')
    
    // 如果没有NPC（用户跳过输入），使用默认NPC
    if (npcs.length === 0 && !npcsInitialized.current) {
      npcsInitialized.current = true
      const defaultNpc: NPC = {
        id: 'npc-default',
        name: '对方',
        title: '场景角色',
        avatar: '👤',
        portraitUrl: null,
        portraitTaskId: null,
        portraitStatus: 'idle',
      }
      setNpcs([defaultNpc])
    }
    
    // 获取最新的npcs状态
    const currentNpcs = useStore.getState().npcs
    const systemPrompt = generateSystemPrompt(sceneDescription, roleDetails, currentNpcs)
    const initPrompt = `场景已准备好。请让场景中的角色用简短的话开始这个场景，引导用户进入对话。记住格式：[角色名] 对话内容`
    
    try {
      addMessage({ role: 'npc', content: '', isStreaming: true })

      await streamResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: initPrompt },
        ],
        (content) => {
          // 实时检测当前说话的NPC
          const match = content.match(/\[([^\]]+)\]/)
          if (match) {
            setTypingNpc(match[1])
          }
          useStore.setState((state) => ({
            messages: state.messages.map((msg, idx) =>
              idx === state.messages.length - 1
                ? { ...msg, content }
                : msg
            ),
          }))
        }
      )

      // 拆分多NPC消息
      finalizeNpcResponse()
    } catch (err) {
      console.error('Initial greeting error:', err)
      const errorMsg = err instanceof Error ? err.message : '连接失败'
      setError(errorMsg)
      // Update the last message with error
      useStore.setState((state) => ({
        messages: state.messages.map((msg, idx) =>
          idx === state.messages.length - 1
            ? { ...msg, content: `（${errorMsg}，点击重试按钮）`, isStreaming: false }
            : msg
        ),
      }))
      setTypingNpc(null)
    } finally {
      setTyping(false)
      setLoading(false)
    }
  }

  const retryLastMessage = async () => {
    // Remove the last error message and retry
    useStore.setState((state) => ({
      messages: state.messages.slice(0, -1),
    }))
    setError(null)
    
    if (messages.length <= 1) {
      greetingSent.current = false
      sendInitialGreeting()
    }
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isTyping) return

    setError(null)
    // Add user message
    addMessage({ role: 'user', content })
    setInputValue('')
    setTyping(true)
    setTypingNpc('生成中...')

    // Build messages for API
    const systemPrompt = mode === 'reversed' && userPersona
      ? generateReversedPrompt(
          sceneDescription,
          roleDetails,
          userPersona,
          messages.filter(m => m.role === 'user').slice(-3).map(m => m.content),
          npcs
        )
      : generateSystemPrompt(sceneDescription, roleDetails, npcs)

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.slice(-10).map((m) => ({
        role: (m.role === 'user' || m.role === 'reversed-user' 
          ? 'user' 
          : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ]

    try {
      addMessage({ role: 'npc', content: '', isStreaming: true })

      await streamResponse(apiMessages, (content) => {
        // 实时检测当前说话的NPC
        const matches = content.match(/\[([^\]]+)\]/g)
        if (matches && matches.length > 0) {
          const lastMatch = matches[matches.length - 1]
          setTypingNpc(lastMatch.slice(1, -1))
        }
        useStore.setState((state) => ({
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, content }
              : msg
          ),
        }))
      })

      // 拆分多NPC消息
      finalizeNpcResponse()
    } catch (err) {
      console.error('Send message error:', err)
      const errorMsg = err instanceof Error ? err.message : '发送失败'
      setError(errorMsg)
      useStore.setState((state) => ({
        messages: state.messages.map((msg, idx) =>
          idx === state.messages.length - 1
            ? { ...msg, content: `（${errorMsg}）`, isStreaming: false }
            : msg
        ),
      }))
      setTypingNpc(null)
    } finally {
      setTyping(false)
    }
  }, [
    isTyping, mode, userPersona, sceneDescription, roleDetails, messages,
    addMessage, setTyping, npcs
  ])

  const handleReverse = useCallback(async () => {
    toggleMode()
    
    if (mode === 'normal') {
      // Switching to reversed mode - AI takes over
      addMessage({
        role: 'system',
        content: '🔄 角色反转！现在你是旁观者，正在观察"你自己"如何对话...',
      })
      
      // Generate AI's imitation of user
      setTyping(true)
      
      const reversedPrompt = generateReversedPrompt(
        sceneDescription,
        roleDetails,
        userPersona || {
          averageLength: 20,
          commonPhrases: ['嗯', '那个'],
          tone: 'nervous',
          fillerWords: ['嗯'],
        },
        messages.filter(m => m.role === 'user').slice(-3).map(m => m.content),
        npcs
      )

      const apiMessages = [
        { role: 'system' as const, content: reversedPrompt },
        ...messages.slice(-6).map((m) => ({
          role: (m.role === 'user' || m.role === 'reversed-user'
            ? 'user'
            : 'assistant') as 'user' | 'assistant',
          content: m.content,
        })),
        { 
          role: 'user' as const, 
          content: '请以用户的身份和风格，继续这段对话。记住要完全模仿用户的说话习惯。' 
        },
      ]

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
        })

        if (!response.ok) throw new Error('API error')

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No reader')

        addMessage({ role: 'reversed-user', content: '', isStreaming: true })

        const decoder = new TextDecoder()
        let buffer = ''
        let fullContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                if (content) {
                  fullContent += content
                  useStore.setState((state) => ({
                    messages: state.messages.map((msg, idx) =>
                      idx === state.messages.length - 1
                        ? { ...msg, content: fullContent }
                        : msg
                    ),
                  }))
                }
              } catch {}
            }
          }
        }

        useStore.setState((state) => ({
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, isStreaming: false }
              : msg
          ),
        }))

        // Then get NPC response
        setTimeout(() => generateNPCResponse(), 1000)
      } catch (error) {
        console.error('Reverse error:', error)
      } finally {
        setTyping(false)
      }
    } else {
      // Switching back to normal mode
      addMessage({
        role: 'system',
        content: '✨ 你已恢复控制，继续你的对话吧！',
      })
    }
  }, [mode, toggleMode, sceneDescription, roleDetails, userPersona, messages, addMessage, setTyping, npcs])

  const generateNPCResponse = async () => {
    setTyping(true)
    setTypingNpc('生成中...')
    
    const systemPrompt = generateSystemPrompt(sceneDescription, roleDetails, npcs)
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...useStore.getState().messages.slice(-8).map((m) => ({
        role: (m.role === 'user' || m.role === 'reversed-user'
          ? 'user'
          : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      addMessage({ role: 'npc', content: '', isStreaming: true })

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                // 实时检测当前说话的NPC
                const matches = fullContent.match(/\[([^\]]+)\]/g)
                if (matches && matches.length > 0) {
                  const lastMatch = matches[matches.length - 1]
                  setTypingNpc(lastMatch.slice(1, -1))
                }
                useStore.setState((state) => ({
                  messages: state.messages.map((msg, idx) =>
                    idx === state.messages.length - 1
                      ? { ...msg, content: fullContent }
                      : msg
                  ),
                }))
              }
            } catch {}
          }
        }
      }

      // 拆分多NPC消息
      finalizeNpcResponse()
    } catch (error) {
      console.error('NPC response error:', error)
      setTypingNpc(null)
    } finally {
      setTyping(false)
    }
  }

  const handleEndSession = async () => {
    setTyping(true)
    
    const feedbackPrompt = generateFeedbackPrompt(
      messages.map(m => ({ role: m.role, content: m.content })),
      userPersona
    )

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是一位温暖的心理咨询师，擅长分析沟通模式。' },
            { role: 'user', content: feedbackPrompt },
          ],
        }),
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
              }
            } catch {}
          }
        }
      }

      setFeedback(fullContent)
      setShowFeedback(true)
    } catch (error) {
      console.error('Feedback error:', error)
      setFeedback('感谢你的参与！继续探索，发现更好的自己。')
      setShowFeedback(true)
    } finally {
      setTyping(false)
    }
  }

  const handleNewSession = () => {
    reset()
    router.push('/')
  }

  // Keyboard shortcut for reverse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' && e.ctrlKey && !isTyping) {
        e.preventDefault()
        handleReverse()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleReverse, isTyping])

  if (!sceneDescription) return null

  return (
    <div className="h-screen flex flex-col">
      {/* Background - 居中显示，边缘模糊 */}
      {backgroundImage && (
        <>
          {/* 模糊背景层 - 填充整个屏幕 */}
          <div 
            className="fixed inset-0 z-0"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px)',
              transform: 'scale(1.1)',
            }}
          />
          {/* 清晰图片层 - 居中显示 */}
          <div 
            className="fixed inset-0 z-0 flex items-center justify-center"
          >
            <img 
              src={backgroundImage} 
              alt="场景背景"
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: '100vh', maxWidth: '100vw' }}
            />
          </div>
        </>
      )}
      {/* 无背景图时的默认渐变 */}
      {!backgroundImage && (
        <div 
          className="fixed inset-0 z-0"
          style={{
            background: 'linear-gradient(135deg, #f0f9f0 0%, #e8f5e9 50%, #f0f9f0 100%)',
          }}
        />
      )}
      {/* 半透明遮罩层，保证文字可读性 */}
      <div className="fixed inset-0 z-0 bg-white/10" />

      {/* Header */}
      <header className="relative z-10 p-4 flex items-center justify-between pixel-border bg-pixel-dark/90">
        <div className="flex items-center gap-3">
          {/* 对话历史按钮 */}
          <button
            className="w-10 h-10 rounded pixel-border bg-pixel-cyan/20 flex items-center justify-center text-lg hover:bg-pixel-cyan/40 transition-colors"
            onClick={() => setShowHistory(!showHistory)}
            title="查看对话历史"
          >
            📜
          </button>
          {/* NPC头像列表 */}
          {npcs.length > 0 && (
            <div className="flex -space-x-2">
              {npcs.slice(0, 3).map((npc, idx) => (
                <div 
                  key={npc.id} 
                  className="w-10 h-10 rounded pixel-border bg-pixel-coral/20 flex items-center justify-center text-lg flex-shrink-0"
                  style={{ zIndex: 3 - idx }}
                  title={`${npc.name}（${npc.title}）`}
                >
                  {npc.avatar}
                </div>
              ))}
              {npcs.length > 3 && (
                <div className="w-10 h-10 rounded pixel-border bg-pixel-dark/80 flex items-center justify-center text-xs text-pixel-gold flex-shrink-0">
                  +{npcs.length - 3}
                </div>
              )}
            </div>
          )}
          <div>
            <h1 className="text-base text-pixel-gold font-bold">
              {npcs.length > 0 
                ? npcs.length === 1 
                  ? `与 ${npcs[0].name} 对话`
                  : `${npcs.map(n => n.name).join('、')}`
                : '共情剧场'}
            </h1>
            <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">
              {sceneDescription.slice(0, 30)}...
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ReverseButton 
            isReversed={mode === 'reversed'} 
            onClick={handleReverse}
            disabled={isTyping || messages.length < 2}
          />
          <button 
            className="pixel-btn pixel-btn-coral text-sm py-2 px-4"
            onClick={handleEndSession}
            disabled={isTyping || messages.length < 3}
          >
            结束
          </button>
        </div>
      </header>

      {/* 对话历史面板 */}
      {showHistory && (
        <div className="fixed top-16 left-4 z-30 w-80 max-h-[60vh] pixel-panel overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-600">
            <h3 className="text-sm text-pixel-gold">📜 对话历史</h3>
            <button
              className="text-gray-400 hover:text-white text-xs"
              onClick={() => setShowHistory(false)}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">暂无对话记录</p>
            ) : (
              messages.map((msg, idx) => {
                // 解析NPC名字
                const npcMatch = msg.content.match(/^\[([^\]]+)\]\s*(.*)$/s)
                const displayName = msg.role === 'user' ? '你' 
                  : msg.role === 'reversed-user' ? '你（AI模拟）'
                  : msg.role === 'system' ? '系统'
                  : npcMatch ? npcMatch[1] : 'NPC'
                const displayContent = npcMatch ? npcMatch[2] : msg.content
                
                return (
                  <div 
                    key={msg.id || idx}
                    className={`text-xs p-2 rounded ${
                      msg.role === 'user' ? 'bg-pixel-cyan/20 text-pixel-cyan' :
                      msg.role === 'reversed-user' ? 'bg-pixel-purple/20 text-pixel-purple' :
                      msg.role === 'system' ? 'bg-pixel-gold/20 text-pixel-gold' :
                      'bg-pixel-coral/20 text-pixel-coral'
                    }`}
                  >
                    <span className="font-bold">{displayName}:</span>
                    <span className="text-gray-300 ml-1">
                      {displayContent.length > 50 ? displayContent.slice(0, 50) + '...' : displayContent}
                    </span>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-500 text-center">
            共 {messages.filter(m => m.role === 'user').length} 条用户发言
          </div>
        </div>
      )}

      {/* Reversed Mode Banner */}
      {mode === 'reversed' && (
        <div className="relative z-10 reversed-banner">
          <span className="text-pixel-gold">👁️</span> 
          {' '}你正在旁观"你自己"与NPC对话...
          {' '}<span className="text-pixel-gold">[Ctrl+R 恢复控制]</span>
        </div>
      )}

      {/* Galgame风格：NPC立绘区域 */}
      <div className="relative z-5 flex-1 flex items-end justify-start pl-8 pb-4">
        {(() => {
          // 获取当前显示的消息
          const currentDisplayMessage = messages[displayIndex]
          let currentNpc: NPC | null = null
          
          if (currentDisplayMessage && currentDisplayMessage.role === 'npc') {
            const match = currentDisplayMessage.content.match(/^\[([^\]]+)\]/)
            if (match) {
              currentNpc = npcs.find(n => n.name === match[1]) || null
            }
          }
          
          // 如果正在输入，使用typingNpc
          if (isTyping && typingNpc) {
            currentNpc = npcs.find(n => n.name === typingNpc) || currentNpc
          }

          return currentNpc ? (
            <NpcPortrait 
              npc={currentNpc}
              isVisible={true}
            />
          ) : null
        })()}
      </div>

      {/* Galgame风格：底部对话框 */}
      <div onClick={handleDialogueClick} className="cursor-pointer">
        <DialogueBox
          currentMessage={messages.length > 0 ? messages[displayIndex] : null}
          currentNpc={(() => {
            const currentDisplayMessage = messages[displayIndex]
            if (currentDisplayMessage && currentDisplayMessage.role === 'npc') {
              const match = currentDisplayMessage.content.match(/^\[([^\]]+)\]/)
              if (match) {
                return npcs.find(n => n.name === match[1]) || null
              }
            }
            return null
          })()}
          isTyping={isTyping}
          typingNpcName={typingNpc}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={sendMessage}
          disabled={isTyping || mode === 'reversed' || isAutoPlaying}
          placeholder={isAutoPlaying ? '点击跳过...' : mode === 'reversed' ? '旁观模式中...' : '输入你的回复...'}
          mode={mode}
        />
      </div>

      {/* 消息队列提示 */}
      {isAutoPlaying && displayIndex < messages.length - 1 && (
        <div className="fixed bottom-48 right-4 z-20 text-xs text-pixel-cyan animate-pulse">
          点击继续 ({displayIndex + 1}/{messages.length})
        </div>
      )}

      {/* Feedback Panel */}
      {showFeedback && (
        <FeedbackPanel 
          feedback={feedback || ''} 
          onClose={() => setShowFeedback(false)}
          onNewSession={handleNewSession}
        />
      )}

      {/* Image loading indicator with progress */}
      {imageStatus === 'generating' && (
        <div className="fixed top-20 left-4 z-20 pixel-panel p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl animate-pulse">🎨</span>
            <div className="w-40">
              <div className="text-sm text-pixel-cyan mb-1">
                {imageProgress < 30 ? '排队中...' : imageProgress < 60 ? '生成中...' : '即将完成...'}
              </div>
              <div className="h-3 bg-pixel-dark relative">
                <div 
                  className="h-full bg-pixel-cyan transition-all duration-500"
                  style={{ width: `${imageProgress}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-pixel-gold">{imageProgress}%</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            图片生成可能需要数分钟
          </div>
        </div>
      )}

      {/* NPC Portrait loading indicator */}
      {npcs.some(npc => npc.portraitStatus === 'generating') && (
        <div className="fixed top-20 right-4 z-20 pixel-panel p-3">
          <div className="text-sm text-pixel-coral mb-2">🎭 画像生成中</div>
          {npcs.filter(npc => npc.portraitStatus === 'generating').map(npc => (
            <div key={npc.id} className="text-xs text-gray-400">
              {npc.avatar} {npc.name}...
            </div>
          ))}
        </div>
      )}

      {/* Image generation failed notice */}
      {imageStatus === 'failed' && !backgroundImage && (
        <div className="fixed top-20 left-4 z-20 text-sm text-gray-400">
          背景生成超时，使用默认背景
        </div>
      )}

      {/* Error and Retry */}
      {error && !isTyping && (
        <div className="fixed top-32 right-4 z-20">
          <button
            className="pixel-btn pixel-btn-gold text-sm py-2 px-4"
            onClick={retryLastMessage}
          >
            🔄 重试
          </button>
        </div>
      )}
    </div>
  )
}
