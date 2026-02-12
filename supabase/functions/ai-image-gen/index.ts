import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Supabase secrets - prefixed with MUDBORD_ for organization
const AZURE_ENDPOINT = Deno.env.get('MUDBORD_AI_IMAGE_ENDPOINT')!
const API_KEY = Deno.env.get('MUDBORD_AI_IMAGE_API_KEY')!
const MODEL_DEPLOYMENT = 'gpt-image-1.5'
const API_VERSION = '2025-04-01-preview'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Required: prompt, boardName
  const { 
    prompt, 
    boardName, 
    size = '1024x1024',  // Valid: 1024x1024, 1024x1536, 1536x1024
    n = 1, 
    quality = 'high',   // Valid: low, medium, high
    output_format = 'png',  // Valid: png, jpeg (lowercase)
    output_compression = 100,
    background
  } = body

  if (!prompt || !boardName) {
    return new Response(JSON.stringify({ error: 'Missing prompt or boardName' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Build the Azure OpenAI endpoint URL
  // Format: https://<resource>.cognitiveservices.azure.com/openai/deployments/<deployment>/images/generations?api-version=<version>
  const url = `${AZURE_ENDPOINT}/openai/deployments/${MODEL_DEPLOYMENT}/images/generations?api-version=${API_VERSION}`

  // Compose request payload for Azure OpenAI gpt-image-1 series
  const payload: Record<string, unknown> = {
    prompt: `${prompt}\n\nContext: This image is for a moodboard named "${boardName}"`,
    model: MODEL_DEPLOYMENT,
    size,
    n,
    quality,
    output_format,
    output_compression,
  }

  // Add transparent background if requested
  if (background === 'transparent') {
    payload.background = 'transparent'
  }

  console.log('Calling Azure OpenAI:', url)
  console.log('Payload:', JSON.stringify({ ...payload, prompt: payload.prompt?.toString().substring(0, 100) + '...' }))

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json()
    
    if (!res.ok) {
      console.error('Azure API error:', result)
      return new Response(JSON.stringify({ 
        error: result.error?.message || 'Image generation failed',
        details: result 
      }), { 
        status: res.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Return base64 image data - Azure returns { created, data: [{ b64_json }] }
    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error('Fetch error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to connect to Azure OpenAI',
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
