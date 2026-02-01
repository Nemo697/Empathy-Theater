import { NextRequest } from 'next/server'

const API_KEY = 'ms-2a53f589-7f32-4df7-a086-cc381ef883bb'
const BASE_URL = 'https://api-inference.modelscope.cn'

async function callWithRetry(messages: unknown[], retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'ZhipuAI/GLM-4.7-Flash',
        messages,
        stream: true,
        // 增加请求间隔，减少频率限制
        temperature: 0.7,
      }),
    })

    if (response.ok) {
      return response
    }

    // 如果 rate limited (429)，等待更长时间
    if (response.status === 429 && i < retries - 1) {
      const waitTime = (i + 1) * 5000 // 5s, 10s, 15s
      console.log(`Rate limited, waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      continue
    }

    return response
  }
  
  throw new Error('Max retries exceeded')
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    const response = await callWithRetry(messages)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API error:', response.status, errorText)
      return new Response(
        JSON.stringify({ 
          error: response.status === 429 
            ? 'API 请求过于频繁，请稍后重试' 
            : `API 错误: ${response.status}` 
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Forward the stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: '服务器内部错误，请重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
