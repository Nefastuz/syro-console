import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // --- INICIO: ADAPTACIÓN A MCP ---
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.status(204).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') { return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method Not Allowed' } }); }

  const userInput = req.body?.prompt?.text;
  if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }
  // --- FIN: ADAPTACIÓN A MCP ---

  try {
    // El comando !MEMORIZE se mantiene como una directiva especial por pragmatismo.
    // Su migración a una "Tool" de MCP es un paso futuro.
    if (userInput.startsWith('!MEMORIZE')) {
      const contentToMemorize = userInput.replace('!MEMORIZE', '').trim();
      const [key, ...contentParts] = contentToMemorize.split(':');
      const content = contentParts.join(':').trim();

      if (!key || !content) { 
        return res.status(400).json({ error: { code: 'invalid_arguments', message: "Formato incorrecto. Use: !MEMORIZE clave : contenido" } }); 
      }

      const { error } = await supabase
        .from('knowledge_base')
        .insert([{ keyword: key.trim(), information: content }]);
        
      if (error) { throw new Error(`Error en Supabase al escribir memoria: ${error.message}`); }
      
      // Respuesta de éxito en formato MCP
      return res.status(200).json({ 
          completion: { choices: [{ text: `Memoria guardada con la clave: '${key.trim()}'` }] } 
      });
    }

    // --- INICIO: LÓGICA DE RECURSOS (VORO v1.5 - RAG Simulado) ---
    // Se recupera todo el contexto, enmarcado como un "Recurso" de MCP.
    const { data: memories, error: memoryError } = await supabase
      .from('knowledge_base')
      .select('keyword, information');

    if (memoryError) { throw new Error(`Error en Supabase al leer memoria: ${memoryError.message}`); }

    let memoryContext = "No hay conocimiento base disponible.";
    if (memories && memories.length > 0) {
      memoryContext = memories.map(mem => `- ${mem.keyword}: ${mem.information}`).join('\n');
    }
    // --- FIN: LÓGICA DE RECURSOS ---
    
    const systemPrompt = `**Core Identity:**\nEres SYRÓ...\n\n**Source of Knowledge (MCP Resource):**\nUtiliza el siguiente conocimiento base como la verdad fundamental para tu trabajo.\n---\n${memoryContext}\n---\n**Available Tools (MCP):**\nYou have access to tools. To use a tool, respond with a JSON object: {"tool_calls": [{"name": "tool_name", "arguments": {...}}]}. No tools are currently implemented. Acknowledge the user's request and state you cannot perform external actions yet.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_API_BASE });
    const completion = await openai.chat.completions.create({
      model: 'gpt-oss-20b',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const llmResponseText = completion.choices[0].message.content;
    
    // --- INICIO: RESPUESTA MCP ---
    const mcpResponse = {
        completion: {
            choices: [{ text: llmResponseText }]
        }
    };
    res.status(200).json(mcpResponse);
    // --- FIN: RESPUESTA MCP ---

  } catch (error) {
    console.error('Error en el handler de la API (VORO):', error);
    res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor en el módulo VORO.', details: error.message } });
  }
}