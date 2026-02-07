/**
 * get_inspiration Tool - 免费，无需认证
 * 获取单张画廊图片的完整提示词和详情
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenApiClient } from '../lib/meigen-api.js'

export const getInspirationSchema = {
  imageId: z.string().describe('Image ID from search_gallery results'),
}

export function registerGetInspiration(server: McpServer, apiClient: MeiGenApiClient) {
  server.tool(
    'get_inspiration',
    'Get full prompt and image URLs for a gallery image. Use the prompt as inspiration or the URL as a reference image.',
    getInspirationSchema,
    async ({ imageId }) => {
      const image = await apiClient.getImageDetails(imageId)

      if (!image) {
        return {
          content: [{
            type: 'text' as const,
            text: `Image not found: ${imageId}`,
          }],
          isError: true,
        }
      }

      const details = [
        `# Image Details (ID: ${image.id})`,
        '',
        '## Full Prompt',
        image.text || '(No prompt available)',
        '',
        '## Metadata',
        image.model ? `- Model: ${image.model}` : '',
        image.image_width && image.image_height ? `- Dimensions: ${image.image_width}x${image.image_height}` : '',
        `- Likes: ${image.likes}`,
        `- Views: ${image.views}`,
        image.author_display_name ? `- Author: ${image.author_display_name}` : '',
        '',
        '## Images',
        image.thumbnail_url ? `- Thumbnail: ${image.thumbnail_url}` : '',
        ...(image.media_urls || []).map((url, i) => `- Image ${i + 1}: ${url}`),
        '',
        'You can use this prompt as inspiration for your own image generations with generate_image().',
      ].filter(Boolean).join('\n')

      return {
        content: [{
          type: 'text' as const,
          text: details,
        }],
      }
    }
  )
}
