import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.status(204).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') { return res.status(405).json({ message: 'Method Not Allowed' }); }

  const userInput = req.body.command;
  if (!userInput) { return res.status(400).json({ message: 'Prompt es requerido' }); }

  try {
    if (userInput.startsWith('!MEMORIZE')) {
      const contentToMemorize = userInput.replace('!MEMORIZE', '').trim();
      const [key, ...contentParts] = contentToMemorize.split(':');
      const content = contentParts.join(':').trim();

      if (!key || !content) { return res.status(400).json({ message: "Formato incorrecto. Use: !MEMORIZE clave : contenido" }); }

      // --- INICIO DE LA CORRECCIÓN ---
      // Usamos los nombres de columna correctos: 'keyword' e 'information'
      const { error } = await supabase
        .from('knowledge_base')
        .insert([{ keyword: key.trim(), information: content }]);
      // --- FIN DE LA CORRECCIÓN ---
        
      if (error) { throw new Error(`Error en Supabase al escribir memoria: ${error.message}`); }
      
      return res.status(200).json({ message: `Memoria guardada con la clave: '${key.trim()}'` });
    }

    // --- INICIO DE LA CORRECCIÓN ---
    // Leemos usando los nombres de columna correctos: 'keyword' e 'information'
    const { data: memories, error: memoryError } = await supabase
      .from('knowledge_base')
      .select('keyword, information');
    // --- FIN DE LA CORRECCIÓN ---

    if (memoryError) { throw new Error(`Error en Supabase al leer memoria: ${memoryError.message}`); }

    let memoryContext = "No hay conocimiento base disponible.";
    if (memories && memories.length > 0) {
      // --- INICIO DE LA CORRECCIÓN ---
      // Formateamos la salida usando los nombres de columna correctos
      memoryContext = memories.map(mem => `- ${mem.keyword}: ${mem.information}`).join('\n');
      // --- FIN DE LA CORRECCIÓN ---
    }
    
    const systemPrompt = `**Core Identity:**\nEres SYRÓ...\n\n**Source of Knowledge:**\nUtiliza el siguiente conocimiento base como la verdad fundamental para tu trabajo. Estos son hechos y directivas establecidos.\n---\n${memoryContext}\n---\n... (resto de la Constitución)`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_API_BASE });
    const completion = await openai.chat.completions.create({
      model: 'gpt-oss-20b',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const fullText = completion.choices[0].message.content;
    const finalResponse = { candidates: [{ content: { parts: [{ text: fullText }] } }] };
    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Error en el handler de la API (VORO):', error);
    res.status(500).json({ message: 'Error interno del servidor en el módulo VORO.', error: error.message });
  }
}