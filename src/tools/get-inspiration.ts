/**
 * get_inspiration Tool — free, no auth required
 * Gets full prompt content and images for a single entry (local library first, API fallback)
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenApiClient } from '../lib/meigen-api.js'
import { getPromptById } from '../lib/prompt-library.js'

export const getInspirationSchema = {
  imageId: z.string().describe('Image/prompt ID from search_gallery results'),
}

export function registerGetInspiration(server: McpServer, apiClient: MeiGenApiClient) {
  server.tool(
    'get_inspiration',
    'Get the full prompt and all image URLs for a gallery entry. Show the images to the user as visual examples. The prompt can be used directly with generate_image(), and image URLs can be passed as referenceImages for style transfer.',
    getInspirationSchema,
    { readOnlyHint: true },
    async ({ imageId }) => {
      // 1. Check local curated library first
      const local = getPromptById(imageId)
      if (local) {
        const details = [
          `# Trending Prompt #${local.rank}`,
          '',
          '## Generated Images',
          'Show these images to the user as visual examples of what this prompt produces:',
          ...local.images.map((url, i) => `![Image ${i + 1}](${url})`),
          '',
          '## Full Prompt',
          '```',
          local.prompt,
          '```',
          '',
          '## Metadata',
          `- Author: ${local.author_name} (@${local.author})`,
          `- Model: ${local.model}`,
          `- Categories: ${local.categories.join(', ')}`,
          `- Likes: ${local.likes.toLocaleString()}`,
          `- Views: ${local.views.toLocaleString()}`,
          `- Date: ${local.date}`,
          '',
          '## Next Steps',
          '- Use this prompt directly with generate_image() to create a similar image',
          '- Modify the prompt to create your own variation',
          local.images.length > 0
            ? `- Pass "${local.images[0]}" as a referenceImages URL to generate_image() for style transfer`
            : '',
        ].filter(Boolean).join('\n')

        return {
          content: [{
            type: 'text' as const,
            text: details,
          }],
        }
      }

      // 2. Fallback to API query
      try {
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

        const imageUrls = image.media_urls || []
        const details = [
          `# Image Details (ID: ${image.id})`,
          '',
          '## Generated Images',
          'Show these images to the user:',
          image.thumbnail_url ? `![Thumbnail](${image.thumbnail_url})` : '',
          ...imageUrls.map((url, i) => `![Image ${i + 1}](${url})`),
          '',
          '## Full Prompt',
          '```',
          image.text || '(No prompt available)',
          '```',
          '',
          '## Metadata',
          image.model ? `- Model: ${image.model}` : '',
          image.image_width && image.image_height ? `- Dimensions: ${image.image_width}x${image.image_height}` : '',
          `- Likes: ${image.likes}`,
          `- Views: ${image.views}`,
          image.author_display_name ? `- Author: ${image.author_display_name}` : '',
          '',
          '## Next Steps',
          '- Use this prompt with generate_image() to create a similar image',
          '- Modify the prompt to create your own variation',
          imageUrls.length > 0
            ? `- Pass "${imageUrls[0]}" as a referenceImages URL to generate_image() for style transfer`
            : '',
        ].filter(Boolean).join('\n')

        return {
          content: [{
            type: 'text' as const,
            text: details,
          }],
        }
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: `Image not found: ${imageId}. This ID is not in the curated library and the online gallery is unavailable.`,
          }],
          isError: true,
        }
      }
    }
  )
}
