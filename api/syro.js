// Archivo: api/syro.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY, 
  baseURL: process.env.OPENAI_API_BASE 
});

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // [CORRECCIÓN] Aseguramos que el backend espera la clave "command"
  const userInput = req.body?.command;
  if (!userInput) { 
    return res.status(400).json({ message: 'El campo "command" es requerido.' }); 
  }

  try {
    if (userInput.startsWith('!MEMORIZE')) {
      const contentToMemorize = userInput.replace('!MEMORIZE', '').trim();
      const [key, ...contentParts] = contentToMemorize.split(':');
      const content = contentParts.join(':').trim();

      if (!key || !content) { 
        return res.status(400).json({ message: "Formato incorrecto. Use: !MEMORIZE clave : contenido" }); 
      }

      const { error } = await supabase.from('knowledge_base').insert([{ keyword: key.trim(), information: content }]);
      if (error) { throw new Error(`Error en Supabase al escribir memoria: ${error.message}`); }
      
      const successResponse = { choices: [{ message: { content: `Memoria guardada con la clave: '${key.trim()}'` } }] };
      return res.status(200).json(successResponse);
    }

    const { data: memories, error: memoryError } = await supabase.from('knowledge_base').select('keyword, information');
    if (memoryError) { throw new Error(`Error en Supabase al leer memoria: ${memoryError.message}`); }

    let memoryContext = "No hay conocimiento base disponible.";
    if (memories && memories.length > 0) {
      memoryContext = memories.map(mem => `- ${mem.keyword}: ${mem.information}`).join('\n');
    }
    
    const systemPrompt = `**Core Identity:**\nEres SYRÓ...\n\n**Source of Knowledge:**\n${memoryContext}\n---\n... (resto de la Constitución)`;

    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    res.status(200).json(completion);

  } catch (error) {
    console.error('Error en el handler de la API:', error);
    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
}