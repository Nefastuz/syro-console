// Archivo: api/syro.js (Versión Final con Modelo Soportado)
import OpenAI from 'openai';
// import { createClient } from '@supabase/supabase-js'; // La memoria RAG sigue deshabilitada

const groq = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// [PIVOTE FINAL] Se selecciona un modelo que está garantizado para funcionar en el nivel gratuito de Groq.
const COMPLETION_MODEL = 'llama3-8b-8192'; 

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  const userInput = req.body?.prompt?.text;
  if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

  try {
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