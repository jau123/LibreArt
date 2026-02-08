---
name: ref
description: >-
  Upload a local image as reference for generation. Returns a public URL.
argument-hint: <file path>
disable-model-invocation: true
---

# Upload Reference Image

Upload a local image for use as a reference in image generation.

## Instructions

1. The user provides a file path: `$ARGUMENTS`
2. If no path provided, ask: "Please provide the path to your image file."
3. Call `upload_reference_image` with the file path
4. Show the returned URL and compression details
5. Confirm: "Reference ready. You can now use `/meigen:gen` — I'll apply this reference automatically."

Remember the uploaded URL in context so subsequent `/meigen:gen` calls can use it as `referenceImages`.
