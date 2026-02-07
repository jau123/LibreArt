/**
 * enhance_prompt Tool - 免费，纯本地
 * 返回 system prompt 让宿主 LLM 执行扩写，不调用任何外部 API
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSystemPrompt, type PromptStyle } from '../lib/prompts.js'

export const enhancePromptSchema = {
  prompt: z.string().describe('The simple prompt to enhance (e.g., "a cat in a garden")'),
  style: z.enum(['realistic', 'anime', 'illustration']).optional().default('realistic')
    .describe('Target visual style: realistic (photorealistic), anime (2D/Japanese), illustration (concept art)'),
}

export function registerEnhancePrompt(server: McpServer) {
  server.tool(
    'enhance_prompt',
    'Transform a simple idea into a professional image generation prompt. Free, no API key needed.',
    enhancePromptSchema,
    async ({ prompt, style }) => {
      const systemPrompt = getSystemPrompt(style as PromptStyle)

      return {
        content: [{
          type: 'text' as const,
          text: `Please enhance the following prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nUser's prompt to enhance:\n"${prompt}"\n\nPlease generate the enhanced prompt now.`,
        }],
      }
    }
  )
}
