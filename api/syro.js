import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// --- Configuración ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    db: {
      schema: 'public',
    },
  }
);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const COMPLETION_MODEL = 'gpt-oss-20b';
const MATCH_THRESHOLD = 0.73;
const MATCH_COUNT = 5;

export const config = { api: { bodyParser: true } };

// --- Handler Principal ---
export default async function handler(req, res) {
  // NOTA: El input ahora se espera en formato MCP.
  const userInput = req.body?.prompt?.text;
  if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

  try {
    if (userInput.startsWith('!MEMORIZE')) {
      const contentToMemorize = userInput.replace('!MEMORIZE', '').trim();
      const [key, ...contentParts] = contentToMemorize.split(':');
      const content = `[${key.trim()}] ${contentParts.join(':').trim()}`;
      if (!key || !contentParts.join(':').trim()) { return res.status(400).json({ error: { code: 'invalid_arguments', message: "Formato incorrecto. Use: !MEMORIZE clave : contenido" } }); }
      
      const embeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: content });
      const embedding = embeddingResponse.data[0].embedding;
      
      const { error } = await supabase.from('knowledge_vectors').insert({ content: content, embedding: embedding });
      if (error) { throw new Error(`Error en Supabase al escribir vector: ${error.message}`); }
      
      // Respuesta en formato MCP
      return res.status(200).json({ completion: { choices: [{ text: `Memoria semántica guardada para la clave: '${key.trim()}'` }] } });
    }

    const queryEmbeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: userInput });
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    const { data: matchedKnowledge, error: matchError } = await supabase.rpc('match_knowledge', {
      p_query_embedding: queryEmbedding,
      p_match_threshold: MATCH_THRESHOLD,
      p_match_count: MATCH_COUNT,
    });

    if (matchError) {
      throw new Error(`Error en RPC match_knowledge: ${matchError.message}`);
    }

    const memoryContext = matchedKnowledge && matchedKnowledge.length > 0
      ? matchedKnowledge.map(k => `- ${k.content}`).join('\n')
      : "No hay conocimiento relevante en la base de datos para esta consulta.";
    
    const systemPrompt = `**Core Identity:**\nEres SYRÓ...\n\n**Relevant Knowledge (VORO v2 - RAG):**\n${memoryContext}\n\n... (resto de la constitución)`;

    const completion = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const llmResponseText = completion.choices[0].message.content;
    // Respuesta en formato MCP
    const mcpResponse = { completion: { choices: [{ text: llmResponseText }] } };
    res.status(200).json(mcpResponse);

  } catch (error) {
    console.error('Error en el handler de la API (VORO v2):', error);
    res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor en el módulo VORO.', details: error.message } });
  }
}