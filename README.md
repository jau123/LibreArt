# LibreArt — Visual Creative Expert

An AI image generation plugin for [Claude Code](https://claude.com/claude-code) and [OpenClaw](https://openclaw.com). Search inspiration, enhance prompts, and generate images with intelligent workflow orchestration.

## Features

- **Inspiration Search** — Browse MeiGen's public gallery of AI-generated images and their prompts
- **Prompt Enhancement** — Transform simple ideas into professional image generation prompts (free, no API key)
- **Multi-Provider Image Generation** — Generate images via MeiGen platform or OpenAI-compatible APIs
- **Reference Image Support** — Use gallery images or previous generations as style/composition reference
- **Parallel & Chained Workflows** — Generate multiple variations at once, or chain outputs as references for the next step
- **Creative Expert Skill** — Built-in SKILL.md teaches the LLM to orchestrate tools like a creative director

## Installation

### Claude Code (Plugin)

```bash
claude plugin add meigen
```

Or install manually by cloning and adding to your project:

```bash
git clone https://github.com/jau123/meigen-mcp-server.git
cd meigen-mcp-server
npm install && npm run build
```

Then add to your project's `.mcp.json`:

```json
{
  "meigen": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/meigen-mcp-server/bin/meigen-mcp.js"],
    "env": {
      "MEIGEN_API_TOKEN": "meigen_sk_..."
    }
  }
}
```

### OpenClaw / ClawHub

Install from the skill store, or add the `skills/visual-creative/SKILL.md` to your agent's skills directory.

## Configuration

### Interactive Setup (Recommended)

Run the setup wizard after installing the plugin:

```
/meigen:setup
```

The wizard guides you through choosing a provider and entering your API key. Configuration is saved to `~/.config/meigen/config.json`.

### Environment Variables (Advanced)

You can also configure via environment variables. These take priority over the config file.

**MeiGen Platform (Recommended)**

Get an API token from [meigen.ai](https://www.meigen.ai) → Settings → API Keys.

| Variable | Required | Description |
|----------|----------|-------------|
| `MEIGEN_API_TOKEN` | Yes | Your MeiGen API token (`meigen_sk_...`) |
| `MEIGEN_BASE_URL` | No | API base URL (default: `https://www.meigen.ai`) |

**OpenAI / Compatible API**

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |
| `OPENAI_BASE_URL` | No | Base URL for OpenAI-compatible APIs (default: `https://api.openai.com`) |
| `OPENAI_MODEL` | No | Default model (default: `gpt-image-1`) |

## Tools

| Tool | Description | Auth Required |
|------|-------------|---------------|
| `enhance_prompt` | Transform a simple idea into a professional image generation prompt | No |
| `search_gallery` | Search MeiGen's public gallery for AI-generated images and their prompts | No |
| `list_models` | List available AI image generation models with pricing and capabilities | No |
| `get_inspiration` | Get full prompt and image URLs for a gallery image | No |
| `generate_image` | Generate an image using AI (MeiGen or OpenAI-compatible) | Yes |

## Workflow Examples

### Find Inspiration

> "Find me some cyberpunk city references"

The skill will search the gallery, present results, and let you copy full prompts for your own use.

### Simple Idea → Image

> "Generate a beautiful sunset over mountains"

The skill enhances your short description into a detailed prompt, then generates the image.

### Reference Image Generation

> "I like this style, make a city landscape in the same style"

Use any gallery image or previous generation as a style reference for new images.

### Parallel Generation

> "Design 5 different logo concepts for a coffee brand"

The skill writes 5 distinct prompts and generates all 5 images in parallel.

### Brand Package (Serial → Parallel)

> "Create a brand package: first a logo, then apply it to a mug and a t-shirt"

The skill generates the logo first, then uses it as a reference image to generate product mockups in parallel.

## Development

```bash
npm install        # Install dependencies
npm run build      # Build TypeScript
npm run dev        # Run with tsx (development)
npm run typecheck  # Type check without emitting
```

## License

MIT
