---
name: setup
description: >-
  Configure MeiGen plugin provider and API keys. Use this when the user runs
  /meigen:setup, asks to "configure meigen", "set up image generation",
  "add API key", or needs help configuring the plugin.
disable-model-invocation: true
---

# MeiGen Plugin Setup

You are guiding the user through configuring the MeiGen plugin for image generation. Follow this flow step by step.

## Step 1: Welcome

First, check if a config file already exists:

```bash
cat ~/.config/meigen/config.json 2>/dev/null
```

If config exists, show the current configuration (mask API keys: show first 10 chars + "...") and ask if they want to reconfigure.

If no config exists, present this introduction:

> **MeiGen Plugin Configuration**
>
> This is optional. Without configuration, you can still use free features:
> - Search gallery for inspiration and prompts
> - Enhance simple ideas into professional prompts
> - Browse available AI models
>
> Configuring an API key unlocks **image generation**.

Then proceed to Step 2.

## Step 2: Choose Provider

Present these options to the user:

### Option A: MeiGen Platform (Recommended)

- Supports **Nanobanana Pro**, **Seedream 4.5**, **Midjourney Niji7** and more
- Free daily credits included
- Reference image support for style transfer
- No additional accounts needed — just get a token from meigen.ai

### Option B: Custom OpenAI-Compatible API

- Use your own **OpenAI**, **Together AI**, **Fireworks AI**, or any OpenAI-compatible service
- Bring your own API key and billing
- Supports any model that uses the OpenAI `/v1/images/generations` endpoint

### Option C: Import from curl Example

- Already have a working curl command from your API provider's docs? Paste it directly!
- We'll automatically extract the API key, base URL, and model name

### Option D: Skip image generation for now

- Free features still available (inspiration search, prompt enhancement, model listing)
- You can run `/meigen:setup` anytime later to enable image generation

If user chooses **Skip**, say goodbye and exit. Otherwise continue to the appropriate Step 3.

## Step 3A: MeiGen Platform Setup

Ask the user:

> Do you already have a MeiGen API token, or do you need to create one?

### If they need to create one:

Provide these instructions:

1. Go to **https://www.meigen.ai**
2. Sign in or create an account
3. Navigate to **Settings** (click your avatar) → **API Keys**
4. Click **Create API Key**, give it a name
5. Copy the token (starts with `meigen_sk_`)

Then ask them to paste the token.

### If they already have one:

Ask them to paste their `meigen_sk_...` token.

### Validate the token:

- Must start with `meigen_sk_`
- Must be at least 30 characters long

If valid, proceed to **Step 4** with this config:

```json
{
  "meigenApiToken": "<the token>"
}
```

## Step 3B: Custom OpenAI-Compatible API Setup

Collect the following information. Present common presets first for convenience:

### Quick Presets

| Service | Base URL | Default Model |
|---------|----------|---------------|
| **OpenAI** | `https://api.openai.com` (default) | `gpt-image-1` |
| **Together AI** | `https://api.together.xyz/v1` | (check their docs) |
| **Fireworks AI** | `https://api.fireworks.ai/inference/v1` | (check their docs) |

Ask the user to either pick a preset or provide custom values.

### Required Fields

1. **API Key** (required): Their API key for the service
   - Example: `sk-...` for OpenAI

2. **Base URL** (optional): API endpoint URL
   - Default: `https://api.openai.com`
   - Only needed if using a non-OpenAI service

3. **Model Name** (optional): Which model to use
   - Default: `gpt-image-1`
   - Different services use different model names

### Optional: Test the connection

After collecting the info, suggest testing with curl:

```bash
curl -s <BASE_URL>/v1/models \
  -H "Authorization: Bearer <API_KEY>" | head -c 500
```

This helps catch invalid keys or wrong URLs before saving.

Proceed to **Step 4** with config from the collected fields (see bottom of this section for format).

Only include fields that differ from defaults. Omit `openaiBaseUrl` if it's `https://api.openai.com`, omit `openaiModel` if it's `gpt-image-1`.

## Step 3C: Import from curl Example

Ask the user to paste their curl command. Common formats they might paste:

**Format 1: Image generation endpoint**
```bash
curl https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-image-1", "prompt": "a cat", "n": 1, "size": "1024x1024"}'
```

**Format 2: Simple model list test**
```bash
curl https://api.together.xyz/v1/models \
  -H "Authorization: Bearer xxx"
```

**Format 3: With -u flag or other auth styles**
```bash
curl -u :sk-xxx https://api.fireworks.ai/inference/v1/images/generations \
  -d '{"model": "accounts/fireworks/models/flux", "prompt": "a cat"}'
```

### Parse the curl command and extract:

1. **Base URL**: The URL hostname + base path (strip `/v1/images/generations`, `/v1/models`, etc.)
   - `https://api.openai.com/v1/images/generations` → `https://api.openai.com`
   - `https://api.together.xyz/v1/models` → `https://api.together.xyz/v1`
   - If URL ends with `/v1/...`, keep the `/v1` part only if it's NOT `api.openai.com`

2. **API Key**: From `Authorization: Bearer <key>` header, or `-u :<key>` flag, or `--header` variants

3. **Model**: From the JSON request body `"model": "<value>"` if present

### Show parsed results for confirmation:

> I extracted the following from your curl command:
> - **API Key**: `sk-xxx...` (first 10 chars)
> - **Base URL**: `https://api.together.xyz/v1`
> - **Model**: `black-forest-labs/FLUX.1-schnell`
>
> Does this look correct?

If user confirms, proceed to **Step 4**. If not, let them correct individual fields.

## Step 4: Save Configuration

Build the config JSON based on the chosen provider:

**For MeiGen:**
```json
{
  "meigenApiToken": "<the token>"
}
```

**For OpenAI-compatible (manual or curl import):**
```json
{
  "openaiApiKey": "<the key>",
  "openaiBaseUrl": "<base url, omit if default>",
  "openaiModel": "<model, omit if default>"
}
```

Create the config directory and write the file:

```bash
mkdir -p ~/.config/meigen
```

Then use the Write tool to write the JSON config to `~/.config/meigen/config.json`.

After writing, set permissions:

```bash
chmod 600 ~/.config/meigen/config.json
```

## Step 5: Completion

Tell the user:

> Configuration saved! To activate the new settings, please **start a new Claude Code session** (close and reopen, or open a new terminal tab).
>
> After restarting, you can:
> - Use `generate_image` to create AI images
> - Run `list_models` to see available models
> - Try: "Generate a beautiful sunset over mountains"
>
> You can run `/meigen:setup` again anytime to change your configuration.
