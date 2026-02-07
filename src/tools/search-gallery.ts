/**
 * search_gallery Tool — free, no auth required
 * Searches the local curated prompt library (1300+ high-quality prompts)
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  searchPrompts,
  getRandomPrompts,
  getLibraryStats,
  ALL_CATEGORIES,
} from '../lib/prompt-library.js'

export const searchGallerySchema = {
  query: z.string().optional()
    .describe('Search keywords (e.g., "cyberpunk", "product photo", "portrait"). Leave empty to browse by category or get random picks.'),
  category: z.enum(['3D', 'App', 'Food', 'Girl', 'JSON', 'Other', 'Photograph', 'Product']).optional()
    .describe('Filter by category. Available: 3D, App, Food, Girl, JSON, Other, Photograph, Product'),
  limit: z.number().min(1).max(20).optional().default(5)
    .describe('Number of results (1-20, default 5)'),
  offset: z.number().min(0).optional().default(0)
    .describe('Pagination offset'),
  sortBy: z.enum(['rank', 'likes', 'views', 'date']).optional().default('rank')
    .describe('Sort order when browsing without search query (default: rank)'),
}

export function registerSearchGallery(server: McpServer) {
  server.tool(
    'search_gallery',
    'Search 1300+ curated AI image prompts with preview images. Results include image URLs — render them as markdown images (![](url)) so users can visually browse and pick styles. Use when users need inspiration, want to explore styles, or say "generate an image" without a specific idea.',
    searchGallerySchema,
    { readOnlyHint: true },
    async ({ query, category, limit, offset, sortBy }) => {
      // No search criteria — return random picks
      if (!query && !category && offset === 0) {
        const random = getRandomPrompts(limit)
        const stats = getLibraryStats()
        const header = `Curated Prompt Library: ${stats.total} trending prompts\nCategories: ${Object.entries(stats.categories).map(([k, v]) => `${k} (${v})`).join(', ')}\n\nHere are ${limit} random picks — show the preview images to the user:\n`
        return {
          content: [{
            type: 'text' as const,
            text: header + formatResults(random),
          }],
        }
      }

      const results = searchPrompts({ query, category, limit, offset, sortBy })

      if (results.length === 0) {
        const suggestion = category
          ? `No results for "${query || ''}" in category "${category}". Try a different keyword or remove the category filter.`
          : `No results for "${query}". Try broader keywords like "portrait", "landscape", "product", "anime".`
        return {
          content: [{
            type: 'text' as const,
            text: suggestion,
          }],
        }
      }

      const searchDesc = [
        query ? `"${query}"` : null,
        category ? `category: ${category}` : null,
      ].filter(Boolean).join(', ')

      const text = `Found ${results.length} results${searchDesc ? ` for ${searchDesc}` : ''}:\n\n${formatResults(results)}\n\nShow the preview images above to the user so they can visually browse. Use get_inspiration(imageId) to get the full prompt and all images for any entry the user likes.`

      return {
        content: [{
          type: 'text' as const,
          text,
        }],
      }
    }
  )
}

function formatResults(results: ReturnType<typeof searchPrompts>): string {
  return results.map((item, i) => {
    // Truncate prompt to first 150 chars for preview
    const promptPreview = item.prompt.length > 150
      ? item.prompt.slice(0, 150).replace(/\n/g, ' ') + '...'
      : item.prompt.replace(/\n/g, ' ')

    const parts = [
      `${i + 1}. **#${item.rank}** by ${item.author_name} — ${item.categories.join(', ')}`,
      `   ![Preview #${item.rank}](${item.image})`,
      `   Prompt: ${promptPreview}`,
      `   Stats: ${item.likes} likes, ${item.views.toLocaleString()} views`,
      `   ID: ${item.id}`,
    ]
    return parts.join('\n')
  }).join('\n\n')
}
