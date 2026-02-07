/**
 * generate_image Tool - 需认证，双模式
 * 模式 A：用户自带 API Key → 调用 OpenAI 兼容 API
 * 模式 B：MeiGen 账户 → 调用 MeiGen 平台 API
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenConfig, ProviderType } from '../config.js'
import { getDefaultProvider, getAvailableProviders } from '../config.js'
import type { MeiGenApiClient } from '../lib/meigen-api.js'
import { OpenAIProvider } from '../lib/providers/openai.js'

export const generateImageSchema = {
  prompt: z.string().describe('The image generation prompt'),
  model: z.string().optional()
    .describe('Model name. For OpenAI-compatible: gpt-image-1, dall-e-3, etc. For MeiGen: use model IDs from list_models.'),
  size: z.string().optional()
    .describe('Image size for OpenAI-compatible providers: "1024x1024", "1536x1024", "auto". MeiGen: use aspectRatio instead.'),
  aspectRatio: z.string().optional()
    .describe('Aspect ratio for MeiGen: "1:1", "3:4", "4:3", "16:9", "9:16"'),
  quality: z.string().optional()
    .describe('Image quality for OpenAI-compatible providers: "low", "medium", "high"'),
  referenceImages: z.array(z.string()).optional()
    .describe('Reference image URLs for style/content guidance. Get URLs from search_gallery/get_inspiration or previous generate_image results. MeiGen provider only.'),
  provider: z.enum(['openai', 'meigen']).optional()
    .describe('Which provider to use. Auto-detected from configured API keys if not specified.'),
}

export function registerGenerateImage(server: McpServer, apiClient: MeiGenApiClient, config: MeiGenConfig) {
  server.tool(
    'generate_image',
    'Generate an image using AI. Supports OpenAI-compatible APIs or MeiGen platform. Can use reference images for style guidance.',
    generateImageSchema,
    async ({ prompt, model, size, aspectRatio, quality, referenceImages, provider: requestedProvider }) => {
      const availableProviders = getAvailableProviders(config)

      if (availableProviders.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No image generation providers configured.\n\nTo configure, run /meigen:setup or set one of:\n- MEIGEN_API_TOKEN: Use MeiGen platform (Nanobanana Pro, Seedream 4.5, Niji7)\n- OPENAI_API_KEY: Use OpenAI/compatible API\n\nSee list_models() for available options.',
          }],
          isError: true,
        }
      }

      // 确定使用哪个 Provider
      let providerType: ProviderType
      if (requestedProvider) {
        if (!availableProviders.includes(requestedProvider)) {
          return {
            content: [{
              type: 'text' as const,
              text: `Provider "${requestedProvider}" is not configured. Available: ${availableProviders.join(', ')}`,
            }],
            isError: true,
          }
        }
        providerType = requestedProvider
      } else {
        providerType = getDefaultProvider(config)!
      }

      try {
        switch (providerType) {
          case 'openai':
            return await generateWithOpenAI(config, prompt, model, size, quality)
          case 'meigen':
            return await generateWithMeiGen(apiClient, prompt, model, aspectRatio, referenceImages)
          default:
            return {
              content: [{ type: 'text' as const, text: `Unknown provider: ${providerType}` }],
              isError: true,
            }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{
            type: 'text' as const,
            text: `Image generation failed: ${message}`,
          }],
          isError: true,
        }
      }
    }
  )
}

async function generateWithOpenAI(
  config: MeiGenConfig,
  prompt: string,
  model?: string,
  size?: string,
  quality?: string
) {
  const provider = new OpenAIProvider(config.openaiApiKey!, config.openaiBaseUrl, config.openaiModel)
  const result = await provider.generate({ prompt, model, size, quality })

  return {
    content: [
      {
        type: 'image' as const,
        data: result.imageBase64,
        mimeType: result.mimeType,
      },
      {
        type: 'text' as const,
        text: `Image generated successfully using OpenAI (${model || config.openaiModel}).`,
      },
    ],
  }
}

async function generateWithMeiGen(
  apiClient: MeiGenApiClient,
  prompt: string,
  model?: string,
  aspectRatio?: string,
  referenceImages?: string[]
) {
  // 1. 发起生成请求
  const genResponse = await apiClient.generateImage({
    prompt,
    modelId: model,
    aspectRatio: aspectRatio || '1:1',
    referenceImages,
  })

  if (!genResponse.generationId) {
    throw new Error('No generation ID returned')
  }

  // 2. 轮询等待完成
  const status = await apiClient.waitForGeneration(genResponse.generationId)

  if (status.status === 'failed') {
    throw new Error(status.error || 'Generation failed')
  }

  if (!status.imageUrl) {
    throw new Error('No image URL in completed generation')
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Image generated successfully via MeiGen platform.\nImage URL: ${status.imageUrl}`,
      },
    ],
  }
}
