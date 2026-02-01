'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore, NPC, getAvatarByRole } from '@/store/useStore'
import { generateImagePrompt, generateNpcPortraitPrompt } from '@/lib/prompts'

interface NPCInput {
  name: string
  title: string
}

const PROGRESS_STEPS = [
  { text: '正在分析场景...', duration: 800 },
  { text: '正在构建场景画面...', duration: 1500 },
  { text: '正在生成像素背景...', duration: 2000 },
  { text: '正在准备对话环境...', duration: 1000 },
]

export default function Home() {
  const router = useRouter()
  const { setScene, setImageTaskId, setImageStatus, setLoading, isLoading, setNpcs, setNpcPortraitTaskId } = useStore()
  const [sceneDescription, setSceneDescription] = useState('')
  const [roleDetails, setRoleDetails] = useState('')
  const [npcInputs, setNpcInputs] = useState<NPCInput[]>([
    { name: '', title: '' },
    { name: '', title: '' },
  ])
  const [error, setError] = useState('')
  const [progressStep, setProgressStep] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)

  // 进度动画
  useEffect(() => {
    if (!isLoading) {
      setProgressStep(0)
      setProgressPercent(0)
      return
    }

    let currentStep = 0
    let percent = 0
    
    const stepInterval = setInterval(() => {
      if (currentStep < PROGRESS_STEPS.length - 1) {
        currentStep++
        setProgressStep(currentStep)
      }
    }, 1500)

    const percentInterval = setInterval(() => {
      if (percent < 95) {
        percent += Math.random() * 8 + 2
        if (percent > 95) percent = 95
        setProgressPercent(Math.floor(percent))
      }
    }, 300)

    return () => {
      clearInterval(stepInterval)
      clearInterval(percentInterval)
    }
  }, [isLoading])

  // 添加NPC
  const addNpcInput = () => {
    if (npcInputs.length < 5) {
      setNpcInputs([...npcInputs, { name: '', title: '' }])
    }
  }

  // 删除NPC
  const removeNpcInput = (index: number) => {
    if (npcInputs.length > 1) {
      setNpcInputs(npcInputs.filter((_, i) => i !== index))
    }
  }

  // 更新NPC输入
  const updateNpcInput = (index: number, field: 'name' | 'title', value: string) => {
    const newInputs = [...npcInputs]
    newInputs[index][field] = value
    setNpcInputs(newInputs)
  }

  const handleSubmit = async (e: React.FormEvent, skipImage = false) => {
    e.preventDefault()
    
    if (!sceneDescription.trim()) {
      setError('请描述一个社交场景')
      return
    }
    
    if (sceneDescription.length > 200) {
      setError('场景描述不能超过200字')
      return
    }

    // 验证NPC输入
    const validNpcs = npcInputs.filter(n => n.name.trim() && n.title.trim())
    if (validNpcs.length === 0) {
      setError('请至少添加一个NPC（需填写名字和身份）')
      return
    }

    // 创建NPC对象（包含画像相关字段）
    const npcs: NPC[] = validNpcs.map((n, idx) => ({
      id: `npc-${idx}`,
      name: n.name.trim(),
      title: n.title.trim(),
      avatar: getAvatarByRole(n.title),
      portraitUrl: null,
      portraitTaskId: null,
      portraitStatus: 'idle' as const,
    }))

    setError('')
    setLoading(true)
    setScene(sceneDescription, roleDetails)
    setNpcs(npcs)

    if (skipImage) {
      // Skip image generation, go directly to chat
      setImageStatus('failed')
      router.push('/chat')
      return
    }

    setImageStatus('generating')

    try {
      // Generate background image (non-blocking)
      const imagePrompt = generateImagePrompt(sceneDescription)
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      })

      if (response.ok) {
        const data = await response.json()
        setImageTaskId(data.taskId)
      } else {
        setImageStatus('failed')
      }

      // Generate NPC portraits sequentially with delay to avoid rate limits
      const portraitResults = []
      for (const npc of npcs) {
        try {
          // 添加延迟避免频率限制
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const portraitPrompt = generateNpcPortraitPrompt(npc.name, npc.title)
          const portraitResponse = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: portraitPrompt }),
          })

          if (portraitResponse.ok) {
            const portraitData = await portraitResponse.json()
            console.log(`[Portrait] ${npc.name} taskId: ${portraitData.taskId}`)
            setNpcPortraitTaskId(npc.id, portraitData.taskId)
            portraitResults.push({ npcId: npc.id, taskId: portraitData.taskId, success: true })
          } else {
            console.error(`Failed to generate portrait for ${npc.name}:`, portraitResponse.status)
            portraitResults.push({ npcId: npc.id, success: false })
          }
        } catch (err) {
          console.error(`Failed to generate portrait for ${npc.name}:`, err)
          portraitResults.push({ npcId: npc.id, success: false })
        }
      }

      // Navigate to chat page after all requests are sent
      router.push('/chat')
    } catch (err) {
      console.error('Error:', err)
      // Still navigate even if image fails
      setImageStatus('failed')
      router.push('/chat')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Title */}
        <h1 className="pixel-title text-center mb-4">
          共情剧场
        </h1>
        <p className="text-center text-pixel-cyan text-xs mb-12 leading-relaxed">
          AI Psychodrama Sandplay
          <br />
          <span className="text-gray-400 mt-2 block">
            探索社交场景，发现真实的自己
          </span>
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="pixel-panel">
          <div className="mb-6">
            <label className="block text-xs mb-3 text-pixel-gold">
              描述一个你最害怕或最渴望的社交场景
            </label>
            <textarea
              className="pixel-textarea w-full"
              placeholder="例如：我需要向老板请假，但他平时很严厉，我总是不敢开口..."
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              maxLength={200}
              disabled={isLoading}
            />
            <div className="text-right text-xs text-gray-500 mt-2">
              {sceneDescription.length}/200
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs mb-3 text-pixel-gold">
              角色细节（可选）
            </label>
            <textarea
              className="pixel-input w-full resize-none overflow-hidden"
              placeholder="例如：老板40多岁，说话很直接"
              value={roleDetails}
              onChange={(e) => {
                setRoleDetails(e.target.value)
                // 自动调整高度
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              disabled={isLoading}
              rows={1}
            />
          </div>

          {/* NPC 输入区域 */}
          <div className="mb-8">
            <label className="block text-xs mb-3 text-pixel-gold">
              场景中的人物 <span className="text-pixel-coral">*</span>
            </label>
            <div className="space-y-3">
              {npcInputs.map((npc, index) => (
                <div key={index} className="flex gap-5 items-center">
                  <span className="text-pixel-cyan text-xs w-6">{index + 1}.</span>
                  <input
                    type="text"
                    className="pixel-input w-[30%] min-w-0"
                    placeholder="名字（如：小张）"
                    value={npc.name}
                    onChange={(e) => updateNpcInput(index, 'name', e.target.value)}
                    disabled={isLoading}
                    maxLength={10}
                  />
                  <input
                    type="text"
                    className="pixel-input flex-1 min-w-0"
                    placeholder="身份（如：部门经理）"
                    value={npc.title}
                    onChange={(e) => updateNpcInput(index, 'title', e.target.value)}
                    disabled={isLoading}
                    maxLength={20}
                  />
                  {npcInputs.length > 1 && (
                    <button
                      type="button"
                      className="text-pixel-coral text-xs px-2 hover:text-red-400 flex-shrink-0"
                      onClick={() => removeNpcInput(index)}
                      disabled={isLoading}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {npcInputs.length < 5 && (
              <button
                type="button"
                className="mt-3 text-pixel-cyan text-xs hover:text-cyan-300"
                onClick={addNpcInput}
                disabled={isLoading}
              >
                + 添加更多人物
              </button>
            )}
            <p className="text-[8px] text-gray-500 mt-2">
              最多可添加5个人物，他们将轮流与你对话
            </p>
          </div>

          {error && (
            <div className="text-pixel-coral text-xs mb-4 text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="pixel-btn pixel-btn-gold flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="animate-pulse">生成中...</span>
              ) : (
                '开始探索'
              )}
            </button>
            <button
              type="button"
              className="pixel-btn text-[10px] px-3"
              disabled={isLoading}
              onClick={(e) => handleSubmit(e, true)}
              title="跳过背景生成，直接开始对话"
            >
              快速开始
            </button>
          </div>
          <p className="text-[8px] text-gray-500 mt-3 text-center">
            "快速开始"跳过背景图生成，立即进入对话
          </p>
        </form>

        {/* Tips */}
        <div className="mt-8 text-center text-xs text-gray-500 leading-relaxed">
          <p className="mb-2">小贴士：</p>
          <p>• 对话中随时可以点击"角色反转"</p>
          <p>• 观察AI如何模仿你的说话方式</p>
          <p>• 从第三视角发现自己的沟通模式</p>
        </div>
      </div>

      {/* Loading Overlay with Progress */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center max-w-md w-full px-8">
            {/* Pixel loader animation */}
            <div className="pixel-loader mx-auto mb-8"></div>
            
            {/* Progress text */}
            <p className="text-pixel-blue font-bold mb-6 h-6">
              {PROGRESS_STEPS[progressStep]?.text}
            </p>
            
            {/* Progress bar */}
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-4 border border-gray-200">
              <div 
                className="h-full bg-gradient-to-r from-pixel-blue to-pixel-cyan transition-all duration-300"
                style={{ 
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            
            {/* Percentage */}
            <p className="text-pixel-gold text-sm">
              {progressPercent}%
            </p>
            
            {/* Decorative dots */}
            <div className="flex justify-center gap-2 mt-6">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className={`w-2 h-2 ${i <= progressStep ? 'bg-pixel-gold' : 'bg-gray-600'}`}
                  style={{ 
                    animation: i === progressStep ? 'pulse 1s infinite' : 'none'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
