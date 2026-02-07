/**
 * search_gallery Tool - 免费，无需认证
 * 搜索 MeiGen 公共画廊中的 AI 生成图片和提示词
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenApiClient } from '../lib/meigen-api.js'

export const searchGallerySchema = {
  query: z.string().describe('Search keywords (e.g., "cyberpunk girl", "product photo", "landscape")'),
  limit: z.number().min(1).max(50).optional().default(10)
    .describe('Number of results to return (1-50)'),
  offset: z.number().min(0).optional().default(0)
    .describe('Pagination offset'),
}

export function registerSearchGallery(server: McpServer, apiClient: MeiGenApiClient) {
  server.tool(
    'search_gallery',
    'Search MeiGen\'s public gallery for AI-generated images and their prompts.',
    searchGallerySchema,
    async ({ query, limit, offset }) => {
      const results = await apiClient.searchGallery(query, limit, offset)

      if (results.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No results found for "${query}". Try different keywords.`,
          }],
        }
      }

      const lines = results.map((item, i) => {
        const parts = [
          `${i + 1}. [ID: ${item.id}]`,
          item.text ? `   Prompt: ${item.text.slice(0, 200)}${item.text.length > 200 ? '...' : ''}` : '',
          item.model ? `   Model: ${item.model}` : '',
          `   Stats: ${item.likes} likes, ${item.views} views`,
          item.thumbnail_url ? `   Image: ${item.thumbnail_url}` : '',
          item.media_urls?.[0] ? `   Full: ${item.media_urls[0]}` : '',
        ]
        return parts.filter(Boolean).join('\n')
      })

      const text = `Found ${results.length} results for "${query}":\n\n${lines.join('\n\n')}\n\nUse get_inspiration(imageId) to get the full prompt for any result.`

      return {
        content: [{
          type: 'text' as const,
          text,
        }],
      }
    }
  )
}
