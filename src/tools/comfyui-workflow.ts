/**
 * comfyui_workflow Tool
 * Manage ComfyUI workflow templates: list / view / import / modify / delete
 */

import { z } from 'zod'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenConfig } from '../config.js'
import {
  listWorkflows,
  loadWorkflow,
  saveWorkflow,
  deleteWorkflow,
  workflowExists,
  getWorkflowSummary,
  getEditableNodes,
  detectNodes,
  type ComfyUIWorkflow,
} from '../lib/providers/comfyui.js'

export const comfyuiWorkflowSchema = {
  action: z.enum(['list', 'view', 'import', 'modify', 'delete'])
    .describe('Action to perform on ComfyUI workflows'),

  name: z.string().optional()
    .describe('Workflow name. Required for view/modify/delete. For import, used as the save name (defaults to filename).'),

  filePath: z.string().optional()
    .describe('Path to a ComfyUI API-format workflow JSON file (for import action).'),

  nodeId: z.string().optional()
    .describe('Node ID to modify (for modify action). Use "view" action first to see available node IDs.'),
  input: z.string().optional()
    .describe('Input field name to modify (for modify action). E.g. "steps", "cfg", "sampler_name", "ckpt_name".'),
  value: z.string().optional()
    .describe('New value as JSON (for modify action). Examples: "30", "\\"euler\\"", "7.5", "true".'),
}

export function registerComfyuiWorkflow(server: McpServer, config: MeiGenConfig) {
  server.tool(
    'comfyui_workflow',
    'Manage ComfyUI workflow templates: list, view parameters, import from file, modify settings, or delete.',
    comfyuiWorkflowSchema,
    { readOnlyHint: false, destructiveHint: true },
    async ({ action, name, filePath, nodeId, input, value }) => {
      try {
        switch (action) {
          case 'list':
            return handleList(config)
          case 'view':
            return handleView(name, config)
          case 'import':
            return handleImport(name, filePath)
          case 'modify':
            return handleModify(name, nodeId, input, value, config)
          case 'delete':
            return handleDelete(name)
          default:
            return errorResult(`Unknown action: ${action}`)
        }
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )
}

// ============================================================
// Action Handlers
// ============================================================

function handleList(config: MeiGenConfig) {
  const workflows = listWorkflows()
  if (workflows.length === 0) {
    return textResult(
      'No ComfyUI workflows saved.\n\n' +
      'To import a workflow:\n' +
      '1. Open ComfyUI in your browser\n' +
      '2. Load your preferred workflow\n' +
      '3. Enable Dev Mode (Settings → Enable Dev mode options)\n' +
      '4. Click "Save (API Format)"\n' +
      '5. Use: comfyui_workflow import with the file path'
    )
  }

  const defaultName = config.comfyuiDefaultWorkflow || workflows[0]

  const lines = workflows.map((wfName, i) => {
    try {
      const wf = loadWorkflow(wfName)
      const s = getWorkflowSummary(wf)
      const isDefault = wfName === defaultName ? ' (default)' : ''
      const ckpt = s.checkpoint || 'unknown model'
      const params = [
        s.steps != null ? `${s.steps} steps` : null,
        s.cfg != null ? `CFG ${s.cfg}` : null,
        s.sampler ? s.sampler : null,
        s.width && s.height ? `${s.width}×${s.height}` : null,
      ].filter(Boolean).join(', ')

      return `${i + 1}. ${wfName}${isDefault}\n   ${ckpt}\n   ${params || 'Unable to parse parameters'}\n   Nodes: ${s.nodeCount}`
    } catch {
      return `${i + 1}. ${wfName} (error reading workflow)`
    }
  })

  return textResult(`Saved ComfyUI Workflows:\n\n${lines.join('\n\n')}`)
}

function handleView(name: string | undefined, config: MeiGenConfig) {
  const resolvedName = resolveName(name, config)
  const wf = loadWorkflow(resolvedName)
  const details = getEditableNodes(wf)

  return textResult(`Workflow: ${resolvedName}\n\n## Editable Parameters\n\n${details}`)
}

function handleImport(name: string | undefined, filePath: string | undefined) {
  if (!filePath) {
    return errorResult('filePath is required for import action. Provide the path to your ComfyUI API-format workflow JSON.')
  }

  // Read file
  let content: string
  try {
    // Expand ~ to home directory
    const expandedPath = filePath.replace(/^~/, homedir())
    content = readFileSync(expandedPath, 'utf-8')
  } catch (e) {
    return errorResult(`Cannot read file "${filePath}": ${e instanceof Error ? e.message : String(e)}`)
  }

  // Parse JSON
  let workflow: ComfyUIWorkflow
  try {
    workflow = JSON.parse(content) as ComfyUIWorkflow
  } catch {
    return errorResult('Invalid JSON file. Please ensure this is a valid ComfyUI API-format workflow.')
  }

  // Basic validation: should be an object with node entries
  if (typeof workflow !== 'object' || Array.isArray(workflow) || Object.keys(workflow).length === 0) {
    return errorResult('Invalid workflow format. Expected an object with node IDs as keys.')
  }

  // Detect key nodes
  let nodeMap
  try {
    nodeMap = detectNodes(workflow)
  } catch (e) {
    return errorResult(`Workflow validation failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Determine save name
  const saveName = name || filePath.replace(/^.*[\\/]/, '').replace(/\.json$/i, '') || 'workflow'

  // Check if already exists
  const isOverwrite = workflowExists(saveName)

  // Save
  saveWorkflow(saveName, workflow)

  // Build confirmation
  const summary = getWorkflowSummary(workflow)
  const lines = [
    `Workflow "${saveName}" ${isOverwrite ? 'updated' : 'imported'} successfully!`,
    '',
    'Detected nodes:',
    `  Positive prompt: Node #${nodeMap.positivePrompt}`,
    nodeMap.negativePrompt ? `  Negative prompt: Node #${nodeMap.negativePrompt}` : null,
    `  Sampler: Node #${nodeMap.sampler}`,
    nodeMap.latentImage ? `  Image size: Node #${nodeMap.latentImage}` : null,
    nodeMap.checkpoint ? `  Checkpoint: ${summary.checkpoint || 'Node #' + nodeMap.checkpoint}` : null,
    '',
    'Summary:',
    summary.checkpoint ? `  Model: ${summary.checkpoint}` : null,
    summary.steps != null ? `  Steps: ${summary.steps}` : null,
    summary.cfg != null ? `  CFG: ${summary.cfg}` : null,
    summary.sampler ? `  Sampler: ${summary.sampler}` : null,
    summary.width && summary.height ? `  Size: ${summary.width}×${summary.height}` : null,
    `  Total nodes: ${summary.nodeCount}`,
  ].filter(Boolean)

  // If this is the first workflow, hint about default
  const existing = listWorkflows()
  if (existing.length === 1) {
    lines.push('')
    lines.push(`This is your first workflow — it will be used as the default for image generation.`)
  }

  return textResult(lines.join('\n'))
}

function handleModify(
  name: string | undefined,
  nodeId: string | undefined,
  input: string | undefined,
  value: string | undefined,
  config: MeiGenConfig,
) {
  if (!nodeId || !input || value === undefined) {
    return errorResult(
      'modify action requires: nodeId, input, and value.\n' +
      'Use "view" action first to see available node IDs and parameters.\n' +
      'Example: nodeId="3", input="steps", value="30"'
    )
  }

  const resolvedName = resolveName(name, config)
  const wf = loadWorkflow(resolvedName)

  // Verify node exists
  const node = wf[nodeId]
  if (!node) {
    return errorResult(`Node #${nodeId} not found in workflow "${resolvedName}". Use "view" action to see available nodes.`)
  }

  // Verify input exists
  if (!(input in node.inputs)) {
    const available = Object.keys(node.inputs).filter(k => !Array.isArray(node.inputs[k]))
    return errorResult(
      `Input "${input}" not found in Node #${nodeId} (${node.class_type}).\n` +
      `Available inputs: ${available.join(', ')}`
    )
  }

  // Parse new value
  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(value)
  } catch {
    return errorResult(`Invalid value "${value}". Must be valid JSON. Examples: 30, "euler", 7.5, true`)
  }

  // Record old value
  const oldValue = node.inputs[input]

  // Modify and save
  node.inputs[input] = parsedValue
  saveWorkflow(resolvedName, wf)

  return textResult(
    `Modified workflow "${resolvedName}":\n\n` +
    `Node #${nodeId} (${node.class_type})\n` +
    `  ${input}: ${JSON.stringify(oldValue)} → ${JSON.stringify(parsedValue)}`
  )
}

function handleDelete(name: string | undefined) {
  if (!name) {
    return errorResult('name is required for delete action.')
  }

  if (!workflowExists(name)) {
    return errorResult(`Workflow "${name}" not found.`)
  }

  deleteWorkflow(name)
  return textResult(`Workflow "${name}" deleted.`)
}

// ============================================================
// Helpers
// ============================================================

function resolveName(name: string | undefined, config: MeiGenConfig): string {
  if (name) {
    if (!workflowExists(name)) {
      throw new Error(`Workflow "${name}" not found. Use "list" action to see available workflows.`)
    }
    return name
  }

  const defaultName = config.comfyuiDefaultWorkflow
  if (defaultName && workflowExists(defaultName)) return defaultName

  const all = listWorkflows()
  if (all.length === 0) {
    throw new Error('No workflows saved. Use "import" action to add a workflow first.')
  }
  return all[0]
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true }
}
