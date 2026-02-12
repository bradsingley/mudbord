import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Supabase secrets
const ENDPOINT = Deno.env.get('AI_IMAGE_ENDPOINT')
const API_KEY = Deno.env.get('AI_IMAGE_API_KEY')

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Required: prompt, boardName
  const { prompt, boardName, aspectRatio = '1024x1024', n = 1, quality = 'high', user, output_format = 'PNG', output_compression = 100, background } = body
  if (!prompt || !boardName) {
    return new Response('Missing prompt or boardName', { status: 400 })
  }

  // Compose request to Azure Foundry
  const payload = {
    prompt: `${prompt} (board: ${boardName})`,
    model: 'gpt-image-1.5',
    size: aspectRatio,
    n,
    quality,
    user,
    output_format,
    output_compression,
    ...(background ? { background } : {})
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': API_KEY
    },
    body: JSON.stringify(payload)
  })

  const result = await res.json()
  if (!res.ok) {
    return new Response(JSON.stringify(result), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  }

  // Return base64 image(s)
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
