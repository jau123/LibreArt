/**
 * 图片生成 Provider 接口
 * 面向 OpenAI 兼容 API，不同于项目内的 APIYI Provider
 */

export interface ImageGenerationRequest {
  prompt: string
  model?: string
  size?: string          // "1024x1024", "1536x1024", "auto"
  aspectRatio?: string   // "1:1", "16:9" etc.
  quality?: string
  n?: number
}

export interface ImageGenerationResult {
  imageBase64: string
  mimeType: string
}

export interface ImageProvider {
  name: string
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>
}
