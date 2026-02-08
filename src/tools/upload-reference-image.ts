/**
 * upload_reference_image Tool
 * Compresses a local image and uploads it to R2, returning a public URL
 * for use as referenceImages in generate_image.
 */

import { z } from 'zod'
import { existsSync } from 'fs'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenConfig } from '../config.js'
import { processAndUploadImage } from '../lib/upload.js'

export const uploadReferenceImageSchema = {
  filePath: z.string()
    .describe('Absolute path to a local image file (JPEG, PNG, WebP, or GIF). The image will be automatically compressed if needed and uploaded for use as a reference image in generate_image.'),
}

export function registerUploadReferenceImage(server: McpServer, config: MeiGenConfig) {
  server.tool(
    'upload_reference_image',
    'Upload a local image for use as a reference in generate_image. Compresses large images (max 2MB, max 2048px) and returns a public URL. Call this when the user wants to use a local file as a reference image.',
    uploadReferenceImageSchema,
    { readOnlyHint: false, destructiveHint: true },
    async ({ filePath }) => {
      // Validate file exists
      if (!existsSync(filePath)) {
        return {
          content: [{
            type: 'text' as const,
            text: `File not found: ${filePath}`,
          }],
          isError: true,
        }
      }

      try {
        const result = await processAndUploadImage(filePath, config)

        const compressed = result.originalSize !== result.compressedSize
        const sizeInfo = compressed
          ? `Compressed: ${formatSize(result.originalSize)} → ${formatSize(result.compressedSize)}`
          : `Size: ${formatSize(result.originalSize)} (no compression needed)`

        return {
          content: [{
            type: 'text' as const,
            text: [
              `Reference image uploaded successfully.`,
              ``,
              `URL: ${result.publicUrl}`,
              sizeInfo,
              ``,
              `Use this URL in generate_image's referenceImages parameter:`,
              `generate_image(prompt="...", referenceImages=["${result.publicUrl}"])`,
            ].join('\n'),
          }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to upload reference image: ${message}`,
          }],
          isError: true,
        }
      }
    }
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
