// Archivo: api/syro.js (Versión de Sonda de Diagnóstico)
import OpenAI from 'openai';
// import { createClient } from '@supabase/supabase-js'; // Deshabilitado temporalmente

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE,
});

// [PIVOTE ESTRATÉGICO] Usamos un modelo soportado nativamente por el Gateway
const COMPLETION_MODEL = 'groq:llama3-8b-8192'; 

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  const userInput = req.body?.prompt?.text;
  if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

  try {
    // --- INICIO DE LA MODIFICACIÓN DE DIAGNÓSTICO ---
    // Se deshabilita TODA la lógica de RAG (embeddings y Supabase) para aislar la llamada al LLM.
    
    const systemPrompt = `Eres SYRÓ, un agente de IA. Responde de forma concisa.`;

    const completion = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const llmResponseText = completion.choices[0].message.content;
    const mcpResponse = { completion: { choices: [{ text: llmResponseText }] } };
    res.status(200).json(mcpResponse);
    
    // --- FIN DE LA MODIFICACIÓN DE DIAGNÓSTICO ---

  } catch (error) {
    console.error('Error en el handler de la API (Sonda de Diagnóstico):', error);
    res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor.', details: error.message } });
  }
}