/**
 * list_models Tool - 免费，无需认证
 * 列出 MeiGen 平台可用的 AI 图片生成模型
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenApiClient } from '../lib/meigen-api.js'
import type { MeiGenConfig } from '../config.js'
import { getAvailableProviders } from '../config.js'

export const listModelsSchema = {
  activeOnly: z.boolean().optional().default(true)
    .describe('Only show active models (default: true)'),
}

export function registerListModels(server: McpServer, apiClient: MeiGenApiClient, config: MeiGenConfig) {
  server.tool(
    'list_models',
    'List available AI image generation models with pricing and capabilities.',
    listModelsSchema,
    async ({ activeOnly }) => {
      const providers = getAvailableProviders(config)
      const sections: string[] = []

      // MeiGen 平台模型
      try {
        const models = await apiClient.listModels(activeOnly)
        if (models.length > 0) {
          const meigenSection = models.map((m, i) => {
            return [
              `${i + 1}. ${m.name}`,
              `   ID: ${m.id}`,
              `   Credits: ${m.credits_per_generation} per generation`,
              `   4K: ${m.supports_4k ? 'Yes' : 'No'}`,
              `   Ratios: ${m.supported_ratios.join(', ')}`,
              m.description ? `   Description: ${m.description}` : '',
            ].filter(Boolean).join('\n')
          }).join('\n\n')

          sections.push(`## MeiGen Platform Models${providers.includes('meigen') ? '' : ' (requires MEIGEN_API_TOKEN)'}\n\n${meigenSection}`)
        }
      } catch {
        sections.push('## MeiGen Platform Models\n\nUnable to fetch models from MeiGen API.')
      }

      // 用户自带 Key 的模型
      if (providers.includes('openai')) {
        sections.push([
          '## OpenAI Models (using your API key)',
          `   Default: ${config.openaiModel}`,
          `   Base URL: ${config.openaiBaseUrl}`,
          '   Available: gpt-image-1, gpt-image-1.5, dall-e-3',
          '   Sizes: 1024x1024, 1536x1024, 1024x1536, auto',
        ].join('\n'))
      }

      // 配置状态
      const configStatus = providers.length > 0
        ? `\nConfigured providers: ${providers.join(', ')}`
        : '\nNo image generation providers configured. Run /meigen:setup or set MEIGEN_API_TOKEN / OPENAI_API_KEY to enable generate_image.'

      return {
        content: [{
          type: 'text' as const,
          text: sections.join('\n\n') + configStatus,
        }],
      }
    }
  )
}
