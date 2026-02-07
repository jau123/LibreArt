/**
 * MeiGen MCP Server 核心
 * 注册所有 Tools 并配置 Server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from './config.js'
import { MeiGenApiClient } from './lib/meigen-api.js'
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
import { registerSearchGallery } from './tools/search-gallery.js'
import { registerListModels } from './tools/list-models.js'
import { registerGetInspiration } from './tools/get-inspiration.js'
import { registerGenerateImage } from './tools/generate-image.js'

export function createServer() {
  const config = loadConfig()
  const apiClient = new MeiGenApiClient(config)

  const server = new McpServer({
    name: 'meigen',
    version: '0.1.0',
  })

  // 免费功能（无需任何配置）
  registerEnhancePrompt(server)
  registerSearchGallery(server, apiClient)
  registerListModels(server, apiClient, config)
  registerGetInspiration(server, apiClient)

  // 图片生成（需要 API Key 或 MeiGen Token）
  registerGenerateImage(server, apiClient, config)

  return server
}
