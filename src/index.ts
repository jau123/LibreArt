/**
 * MeiGen MCP Server 入口
 * stdio transport - 用于 Claude Desktop / Claude Code / OpenClaw 集成
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server.js'

async function main() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('MeiGen MCP Server failed to start:', error)
  process.exit(1)
})
