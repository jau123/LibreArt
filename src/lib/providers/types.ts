/**
 * Image generation provider interface
 * For OpenAI-compatible APIs (distinct from the project's APIYI provider)
 */

export interface ImageGenerationRequest {
  prompt: string
  model?: string
  size?: string          // "1024x1024", "1536x1024", "auto"
  aspectRatio?: string   // "1:1", "16:9" etc.
  quality?: string
  n?: number
  referenceImages?: string[]  // Public image URLs for style/content guidance
}

export interface ImageGenerationResult {
  imageBase64: string
  mimeType: string
}

export interface ImageProvider {
  name: string
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>
}
