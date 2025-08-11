// Archivo: api/syro.js (Versión de Conexión Directa a Groq)
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// --- Configuración de Clientes ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// [PIVOTE DE ARQUITECTURA] Se inicializa el cliente de OpenAI para apuntar DIRECTAMENTE a la API de Groq.
const groq = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY, // Usamos la clave de Groq
  baseURL: 'https://api.groq.com/openai/v1', // Usamos el endpoint de Groq
});

// --- Configuración de Modelos ---
// NOTA: Groq no ofrece un modelo de embeddings. La lógica RAG está deshabilitada.
const COMPLETION_MODEL = 'llama3-8b-8192'; // Un modelo rápido y fiable disponible en Groq

export const config = { api: { bodyParser: true } };

// --- Handler Principal ---
export default async function handler(req, res) {
  const userInput = req.body?.prompt?.text;
  if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

  try {
    // --- Lógica Simplificada (Sin RAG) ---
    // La lógica de !MEMORIZE y la búsqueda de embeddings están deshabilitadas
    // porque Groq no provee un servicio de embeddings.
    
    const systemPrompt = `Eres SYRÓ, un agente de IA. Responde de forma concisa y directa.`;

    const completion = await groq.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const llmResponseText = completion.choices[0].message.content;
    const mcpResponse = { completion: { choices: [{ text: llmResponseText }] } };
    res.status(200).json(mcpResponse);

  } catch (error) {
    console.error('Error en el handler de la API (Conexión Directa a Groq):', error);
    res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor.', details: error.message } });
  }
}