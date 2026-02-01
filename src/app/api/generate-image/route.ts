import { NextRequest, NextResponse } from 'next/server'

const API_KEY = 'ms-2a53f589-7f32-4df7-a086-cc381ef883bb'
const BASE_URL = 'https://api-inference.modelscope.cn'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    console.log('[generate-image] Prompt:', prompt)

    const response = await fetch(`${BASE_URL}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-ModelScope-Async-Mode': 'true',
        'X-ModelScope-Task-Type': 'image_generation',
      },
      body: JSON.stringify({
        model: 'Tongyi-MAI/Z-Image-Turbo',
        prompt,
      }),
    })

    const responseText = await response.text()
    console.log('[generate-image] Response status:', response.status)
    console.log('[generate-image] Response body:', responseText)

    if (!response.ok) {
      console.error('[generate-image] Error:', responseText)
      return NextResponse.json(
        { error: `Image generation error: ${response.status}`, details: responseText },
        { status: response.status }
      )
    }

    const data = JSON.parse(responseText)
    console.log('[generate-image] Task ID:', data.task_id)
    return NextResponse.json({ taskId: data.task_id })
  } catch (error) {
    console.error('[generate-image] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
