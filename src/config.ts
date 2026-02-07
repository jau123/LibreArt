/**
 * MeiGen MCP Server 配置管理
 * 优先级：环境变量 > ~/.config/meigen/config.json > 默认值
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface MeiGenConfig {
  // MeiGen 平台模式
  meigenApiToken?: string

  // OpenAI 兼容模式（自带 Key）
  openaiApiKey?: string
  openaiBaseUrl: string
  openaiModel: string

  // MeiGen API 基础地址
  meigenBaseUrl: string
}

export type ProviderType = 'openai' | 'meigen'

interface ConfigFile {
  meigenApiToken?: string
  openaiApiKey?: string
  openaiBaseUrl?: string
  openaiModel?: string
}

function loadConfigFile(): ConfigFile {
  try {
    const configPath = join(homedir(), '.config', 'meigen', 'config.json')
    const content = readFileSync(configPath, 'utf-8')
    return JSON.parse(content) as ConfigFile
  } catch {
    return {}
  }
}

export function loadConfig(): MeiGenConfig {
  const file = loadConfigFile()
  return {
    meigenApiToken: process.env.MEIGEN_API_TOKEN || file.meigenApiToken,

    openaiApiKey: process.env.OPENAI_API_KEY || file.openaiApiKey,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || file.openaiBaseUrl || 'https://api.openai.com',
    openaiModel: process.env.OPENAI_MODEL || file.openaiModel || 'gpt-image-1',

    meigenBaseUrl: process.env.MEIGEN_BASE_URL || 'https://www.meigen.ai',
  }
}

/**
 * 检测可用的 Provider
 */
export function getAvailableProviders(config: MeiGenConfig): ProviderType[] {
  const providers: ProviderType[] = []
  if (config.meigenApiToken) providers.push('meigen')
  if (config.openaiApiKey) providers.push('openai')
  return providers
}

/**
 * 获取默认 Provider（按优先级）
 */
export function getDefaultProvider(config: MeiGenConfig): ProviderType | null {
  if (config.meigenApiToken) return 'meigen'
  if (config.openaiApiKey) return 'openai'
  return null
}
