#!/bin/bash
# MeiGen Plugin — PostToolUse hook for generate_image
# Auto-opens the saved image on macOS after generation

# Read JSON input from stdin
INPUT=$(cat)

# Extract "Saved to: /path/to/file" from the tool response text content
SAVED_PATH=$(echo "$INPUT" | \
  jq -r '.tool_response.content[]? | select(.type=="text") | .text // empty' 2>/dev/null | \
  grep -oE 'Saved to: (.+)' | head -1 | sed 's/Saved to: //' | xargs)

# Exit silently if no saved path found
[ -z "$SAVED_PATH" ] && exit 0

# Exit silently if file doesn't exist
[ ! -f "$SAVED_PATH" ] && exit 0

# Open in Preview on macOS (non-blocking)
if [ "$(uname)" = "Darwin" ]; then
  open "$SAVED_PATH" &
fi

exit 0
