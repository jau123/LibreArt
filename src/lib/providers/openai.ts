/**
 * OpenAI 兼容 Provider
 * 支持 gpt-image-1、DALL-E 3，以及任何 OpenAI 兼容服务（Together AI、DeepInfra 等）
 */

import type { ImageProvider, ImageGenerationRequest, ImageGenerationResult } from './types.js'

interface OpenAIImageResponse {
  data: Array<{
    b64_json?: string
    url?: string
  }>
}

export class OpenAIProvider implements ImageProvider {
  name = 'openai'

  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(apiKey: string, baseUrl: string, defaultModel: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.defaultModel = defaultModel
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const model = request.model || this.defaultModel

    const body: Record<string, unknown> = {
      model,
      prompt: request.prompt,
      n: request.n || 1,
      size: request.size || '1024x1024',
    }

    // gpt-image 系列强制返回 base64，不需要 response_format
    // DALL-E 系列需要指定 response_format
    if (model.startsWith('dall-e')) {
      body.response_format = 'b64_json'
    }

    if (request.quality) {
      body.quality = request.quality
    }

    const res = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${errorText}`)
    }

    const json = await res.json() as OpenAIImageResponse

    const imageData = json.data?.[0]
    if (!imageData) {
      throw new Error('No image data in response')
    }

    if (imageData.b64_json) {
      return {
        imageBase64: imageData.b64_json,
        mimeType: 'image/png',
      }
    }

    // 如果返回的是 URL，下载并转为 base64
    if (imageData.url) {
      const imageRes = await fetch(imageData.url)
      const buffer = await imageRes.arrayBuffer()
      return {
        imageBase64: Buffer.from(buffer).toString('base64'),
        mimeType: imageRes.headers.get('content-type') || 'image/png',
      }
    }

    throw new Error('Response contains neither b64_json nor url')
  }
}
