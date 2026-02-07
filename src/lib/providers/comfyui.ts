/**
 * ComfyUI Local Provider
 * Template-based workflow: users provide a workflow JSON template,
 * generation fills in prompt/seed/size at runtime.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

// ============================================================
// Types
// ============================================================

/** ComfyUI API-format workflow — node IDs as keys */
export type ComfyUIWorkflow = Record<string, ComfyUINode>

export interface ComfyUINode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

/** Auto-detected key node mapping */
export interface WorkflowNodeMap {
  positivePrompt: string
  negativePrompt?: string
  sampler: string
  latentImage?: string
  checkpoint?: string
  saveImage?: string
  loadImages?: string[]
}

/** Workflow summary info */
export interface WorkflowSummary {
  checkpoint?: string
  steps?: number
  cfg?: number
  sampler?: string
  scheduler?: string
  width?: number
  height?: number
  nodeCount: number
}

// ============================================================
// Workflow File Management
// ============================================================

export function getWorkflowsDir(): string {
  return join(homedir(), '.config', 'meigen', 'workflows')
}

export function listWorkflows(): string[] {
  try {
    const dir = getWorkflowsDir()
    const files = readdirSync(dir)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))
      .sort()
  } catch {
    return []
  }
}

export function loadWorkflow(name: string): ComfyUIWorkflow {
  const filePath = join(getWorkflowsDir(), `${name}.json`)
  const content = readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as ComfyUIWorkflow
}

export function saveWorkflow(name: string, workflow: ComfyUIWorkflow): void {
  const dir = getWorkflowsDir()
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${name}.json`)
  writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8')
}

export function deleteWorkflow(name: string): void {
  const filePath = join(getWorkflowsDir(), `${name}.json`)
  unlinkSync(filePath)
}

export function workflowExists(name: string): boolean {
  return existsSync(join(getWorkflowsDir(), `${name}.json`))
}

// ============================================================
// Workflow Node Detection
// ============================================================

const SAMPLER_TYPES = ['KSampler', 'KSamplerAdvanced']
const PROMPT_TYPES = ['CLIPTextEncode']
const LATENT_TYPES = ['EmptyLatentImage']
const CHECKPOINT_TYPES = ['CheckpointLoaderSimple', 'CheckpointLoader']
const SAVE_TYPES = ['SaveImage', 'PreviewImage']
const LOAD_IMAGE_TYPES = ['LoadImage']

/**
 * Auto-detect key nodes in a workflow.
 * Strategy: find KSampler -> trace positive/negative references -> locate prompt nodes
 */
export function detectNodes(workflow: ComfyUIWorkflow): WorkflowNodeMap {
  // 1. Find KSampler
  let samplerId: string | undefined
  for (const [id, node] of Object.entries(workflow)) {
    if (SAMPLER_TYPES.includes(node.class_type)) {
      samplerId = id
      break
    }
  }
  if (!samplerId) {
    throw new Error('No KSampler node found in workflow. Please ensure your workflow contains a KSampler node.')
  }

  const samplerNode = workflow[samplerId]

  // 2. Trace positive/negative references -> CLIPTextEncode
  let positivePromptId: string | undefined
  let negativePromptId: string | undefined

  const positiveRef = samplerNode.inputs.positive
  if (Array.isArray(positiveRef) && typeof positiveRef[0] === 'string') {
    const refId = positiveRef[0]
    if (workflow[refId] && PROMPT_TYPES.includes(workflow[refId].class_type)) {
      positivePromptId = refId
    }
  }

  const negativeRef = samplerNode.inputs.negative
  if (Array.isArray(negativeRef) && typeof negativeRef[0] === 'string') {
    const refId = negativeRef[0]
    if (workflow[refId] && PROMPT_TYPES.includes(workflow[refId].class_type)) {
      negativePromptId = refId
    }
  }

  if (!positivePromptId) {
    // Fallback: find first CLIPTextEncode
    for (const [id, node] of Object.entries(workflow)) {
      if (PROMPT_TYPES.includes(node.class_type)) {
        positivePromptId = id
        break
      }
    }
  }
  if (!positivePromptId) {
    throw new Error('No CLIPTextEncode node found in workflow.')
  }

  // 3. Find EmptyLatentImage (prefer KSampler's latent_image reference)
  let latentImageId: string | undefined
  const latentRef = samplerNode.inputs.latent_image
  if (Array.isArray(latentRef) && typeof latentRef[0] === 'string') {
    const refId = latentRef[0]
    if (workflow[refId] && LATENT_TYPES.includes(workflow[refId].class_type)) {
      latentImageId = refId
    }
  }
  if (!latentImageId) {
    for (const [id, node] of Object.entries(workflow)) {
      if (LATENT_TYPES.includes(node.class_type)) {
        latentImageId = id
        break
      }
    }
  }

  // 4. Find CheckpointLoaderSimple
  let checkpointId: string | undefined
  for (const [id, node] of Object.entries(workflow)) {
    if (CHECKPOINT_TYPES.includes(node.class_type)) {
      checkpointId = id
      break
    }
  }

  // 5. Find SaveImage
  let saveImageId: string | undefined
  for (const [id, node] of Object.entries(workflow)) {
    if (SAVE_TYPES.includes(node.class_type)) {
      saveImageId = id
      break
    }
  }

  // 6. Find LoadImage nodes (for reference image injection)
  const loadImageIds: string[] = []
  for (const [id, node] of Object.entries(workflow)) {
    if (LOAD_IMAGE_TYPES.includes(node.class_type)) {
      loadImageIds.push(id)
    }
  }

  return {
    positivePrompt: positivePromptId,
    negativePrompt: negativePromptId,
    sampler: samplerId,
    latentImage: latentImageId,
    checkpoint: checkpointId,
    saveImage: saveImageId,
    loadImages: loadImageIds.length > 0 ? loadImageIds : undefined,
  }
}

/** Get workflow summary info */
export function getWorkflowSummary(workflow: ComfyUIWorkflow): WorkflowSummary {
  const summary: WorkflowSummary = {
    nodeCount: Object.keys(workflow).length,
  }

  try {
    const nodes = detectNodes(workflow)

    const samplerInputs = workflow[nodes.sampler].inputs
    summary.steps = samplerInputs.steps as number | undefined
    summary.cfg = samplerInputs.cfg as number | undefined
    summary.sampler = samplerInputs.sampler_name as string | undefined
    summary.scheduler = samplerInputs.scheduler as string | undefined

    if (nodes.latentImage) {
      const latentInputs = workflow[nodes.latentImage].inputs
      summary.width = latentInputs.width as number | undefined
      summary.height = latentInputs.height as number | undefined
    }

    if (nodes.checkpoint) {
      summary.checkpoint = workflow[nodes.checkpoint].inputs.ckpt_name as string | undefined
    }
  } catch {
    // Return basic info if parsing fails
  }

  return summary
}

/** Get detailed editable node info for a workflow (used by view action) */
export function getEditableNodes(workflow: ComfyUIWorkflow): string {
  let nodeMap: WorkflowNodeMap
  try {
    nodeMap = detectNodes(workflow)
  } catch (e) {
    return `Error detecting nodes: ${e instanceof Error ? e.message : String(e)}`
  }

  const lines: string[] = []

  // KSampler
  const sampler = workflow[nodeMap.sampler]
  lines.push(`Node #${nodeMap.sampler} (${sampler.class_type}) — ${sampler._meta?.title || 'Main Sampler'}`)
  for (const [key, val] of Object.entries(sampler.inputs)) {
    if (Array.isArray(val)) continue // Skip node connection references
    if (key === 'seed') {
      lines.push(`  ${key}: [auto-randomized per generation]`)
    } else {
      lines.push(`  ${key}: ${JSON.stringify(val)}`)
    }
  }

  // Positive Prompt
  const posNode = workflow[nodeMap.positivePrompt]
  lines.push('')
  lines.push(`Node #${nodeMap.positivePrompt} (${posNode.class_type}) — ${posNode._meta?.title || 'Positive Prompt'}`)
  lines.push(`  text: [replaced by your prompt per generation]`)

  // Negative Prompt
  if (nodeMap.negativePrompt) {
    const negNode = workflow[nodeMap.negativePrompt]
    lines.push('')
    lines.push(`Node #${nodeMap.negativePrompt} (${negNode.class_type}) — ${negNode._meta?.title || 'Negative Prompt'}`)
    const negText = negNode.inputs.text
    lines.push(`  text: ${JSON.stringify(negText)}`)
  }

  // EmptyLatentImage
  if (nodeMap.latentImage) {
    const latent = workflow[nodeMap.latentImage]
    lines.push('')
    lines.push(`Node #${nodeMap.latentImage} (${latent.class_type}) — ${latent._meta?.title || 'Image Size'}`)
    for (const [key, val] of Object.entries(latent.inputs)) {
      if (Array.isArray(val)) continue
      lines.push(`  ${key}: ${JSON.stringify(val)}`)
    }
  }

  // CheckpointLoaderSimple
  if (nodeMap.checkpoint) {
    const ckpt = workflow[nodeMap.checkpoint]
    lines.push('')
    lines.push(`Node #${nodeMap.checkpoint} (${ckpt.class_type}) — ${ckpt._meta?.title || 'Model'}`)
    for (const [key, val] of Object.entries(ckpt.inputs)) {
      if (Array.isArray(val)) continue
      lines.push(`  ${key}: ${JSON.stringify(val)}`)
    }
  }

  lines.push('')
  lines.push('To modify a parameter, use action "modify" with nodeId, input, and value.')
  lines.push('Example: nodeId="3", input="steps", value="30"')

  return lines.join('\n')
}

// ============================================================
// ComfyUI HTTP Client
// ============================================================

interface ComfyUIPromptResponse {
  prompt_id: string
  number: number
  node_errors?: Record<string, unknown>
}

interface ComfyUIHistoryEntry {
  status: { status_str: string; completed: boolean }
  outputs: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>
}

export class ComfyUIProvider {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async checkConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`)
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /** Upload an image to ComfyUI's input directory */
  async uploadImage(imageBuffer: Buffer, filename: string): Promise<string> {
    const blob = new Blob([imageBuffer])
    const formData = new FormData()
    formData.append('image', blob, filename)
    formData.append('overwrite', 'true')

    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`ComfyUI image upload failed (${res.status}): ${errText}`)
    }

    const json = await res.json() as { name: string; subfolder: string; type: string }
    return json.name
  }

  async listCheckpoints(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models/checkpoints`)
      if (!res.ok) return []
      return await res.json() as string[]
    } catch {
      return []
    }
  }

  /** Submit a workflow and wait for the result */
  async generate(
    workflow: ComfyUIWorkflow,
    prompt: string,
    options?: {
      seed?: number
      width?: number
      height?: number
      negativePrompt?: string
      referenceImages?: string[]
    },
    onProgress?: (elapsedMs: number) => Promise<void>,
  ): Promise<{ imageBase64: string; mimeType: string; referenceImageWarning?: string }> {
    // 1. Deep-copy the template
    const wf = JSON.parse(JSON.stringify(workflow)) as ComfyUIWorkflow

    // 2. Detect key nodes
    const nodes = detectNodes(wf)

    // 3. Fill in prompt
    wf[nodes.positivePrompt].inputs.text = prompt

    // 4. Fill in negative prompt (if provided)
    if (options?.negativePrompt && nodes.negativePrompt) {
      wf[nodes.negativePrompt].inputs.text = options.negativePrompt
    }

    // 5. Fill in seed
    const seed = options?.seed ?? Math.floor(Math.random() * 2147483647)
    wf[nodes.sampler].inputs.seed = seed

    // 6. Fill in dimensions (if provided)
    if (nodes.latentImage && (options?.width || options?.height)) {
      if (options?.width) wf[nodes.latentImage].inputs.width = options.width
      if (options?.height) wf[nodes.latentImage].inputs.height = options.height
    }

    // 6.5. Handle reference images for LoadImage nodes
    let referenceImageWarning: string | undefined
    if (options?.referenceImages?.length) {
      if (nodes.loadImages?.length) {
        const count = Math.min(options.referenceImages.length, nodes.loadImages.length)
        for (let i = 0; i < count; i++) {
          const url = options.referenceImages[i]
          const nodeId = nodes.loadImages[i]

          // Download the image from URL
          const imgRes = await fetch(url)
          if (!imgRes.ok) {
            throw new Error(`Failed to download reference image from ${url}: ${imgRes.status}`)
          }
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

          // Upload to ComfyUI's input directory
          const ext = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)?.[1] || 'png'
          const filename = `ref_${Date.now()}_${i}.${ext}`
          const uploadedName = await this.uploadImage(imgBuffer, filename)

          // Inject into LoadImage node
          wf[nodeId].inputs.image = uploadedName
        }
      } else {
        referenceImageWarning = 'The current workflow has no LoadImage nodes, so reference images were not applied. To use reference images with ComfyUI, import a workflow that includes LoadImage nodes (e.g., an img2img workflow).'
      }
    }

    // 7. Submit workflow
    const submitRes = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: wf }),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      throw new Error(`ComfyUI prompt submission failed (${submitRes.status}): ${errText}`)
    }

    const { prompt_id, node_errors } = await submitRes.json() as ComfyUIPromptResponse

    if (node_errors && Object.keys(node_errors).length > 0) {
      throw new Error(`ComfyUI node errors: ${JSON.stringify(node_errors)}`)
    }

    // 8. Poll until completed (max 5 minutes)
    const timeoutMs = 300_000
    const pollInterval = 2_000
    const startTime = Date.now()
    let lastProgress = 0

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval))

      const elapsed = Date.now() - startTime
      if (onProgress && elapsed - lastProgress >= 15_000) {
        await onProgress(elapsed)
        lastProgress = elapsed
      }

      const histRes = await fetch(`${this.baseUrl}/history/${prompt_id}`)
      if (!histRes.ok) continue

      const history = await histRes.json() as Record<string, ComfyUIHistoryEntry>
      const entry = history[prompt_id]
      if (!entry) continue

      if (entry.status.status_str === 'error') {
        throw new Error('ComfyUI generation failed')
      }

      if (!entry.status.completed) continue

      // 9. Find output image
      for (const output of Object.values(entry.outputs)) {
        if (output.images && output.images.length > 0) {
          const img = output.images[0]
          const params = new URLSearchParams({
            filename: img.filename,
            subfolder: img.subfolder,
            type: img.type,
          })

          // 10. Download image
          const imgRes = await fetch(`${this.baseUrl}/view?${params}`)
          if (!imgRes.ok) {
            throw new Error(`Failed to download image from ComfyUI: ${imgRes.status}`)
          }

          const buffer = await imgRes.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          const mimeType = imgRes.headers.get('content-type') || 'image/png'

          return { imageBase64: base64, mimeType, referenceImageWarning }
        }
      }

      throw new Error('ComfyUI generation completed but no output images found')
    }

    throw new Error(`ComfyUI generation timed out after ${timeoutMs / 1000}s`)
  }
}

// ============================================================
// Aspect Ratio -> Size Conversion
// ============================================================

const ASPECT_RATIOS: Record<string, [number, number]> = {
  '1:1': [1, 1],
  '3:4': [3, 4],
  '4:3': [4, 3],
  '16:9': [16, 9],
  '9:16': [9, 16],
}

/**
 * Calculate new dimensions from aspect ratio, preserving total pixel count.
 * Results are rounded to multiples of 8 (SD model requirement).
 */
export function calculateSize(
  aspectRatio: string,
  originalWidth: number,
  originalHeight: number,
): { width: number; height: number } {
  const ratio = ASPECT_RATIOS[aspectRatio]
  if (!ratio) return { width: originalWidth, height: originalHeight }

  const [rw, rh] = ratio
  const totalPixels = originalWidth * originalHeight
  const newHeight = Math.sqrt(totalPixels * rh / rw)
  const newWidth = newHeight * rw / rh

  return {
    width: Math.round(newWidth / 8) * 8,
    height: Math.round(newHeight / 8) * 8,
  }
}
