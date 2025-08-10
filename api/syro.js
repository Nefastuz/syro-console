// Archivo: api/syro.js

// Re-despliegue forzado para invalidar caché de Vercel.

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// --- Configuración ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
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
  const userInput = req.body?.prompt?.text;
  if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

  try {
    // --- Router de Comandos (NAOS) ---
    const commandMatch = userInput.match(/^!(\w+)/);
    if (commandMatch) {
      const command = commandMatch[1].toUpperCase();
      const args = userInput.substring(commandMatch[0].length).trim();
      
      let commandResponse;
      switch (command) {
        case 'MEMORIZE':
          commandResponse = await handleMemorize(args);
          break;
        case 'WRITE':
          commandResponse = await handleWrite(args);
          break;
        case 'READ':
          commandResponse = await handleRead(args);
          break;
        case 'LS':
          commandResponse = await handleLs(args);
          break;
        default:
          commandResponse = { text: `Comando desconocido: !${command}` };
      }
      return res.status(200).json({ completion: { choices: [commandResponse] } });
    }

    // --- Flujo RAG por Defecto ---
    const queryEmbeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: userInput });
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    const { data: matchedKnowledge, error: matchError } = await supabase.rpc('match_knowledge', {
      p_query_embedding: queryEmbedding,
      p_match_threshold: MATCH_THRESHOLD,
      p_match_count: MATCH_COUNT,
    });

    if (matchError) throw new Error(`Error en RPC match_knowledge: ${matchError.message}`);

    const memoryContext = matchedKnowledge && matchedKnowledge.length > 0
      ? matchedKnowledge.map(k => `- ${k.content}`).join('\n')
      : "No hay conocimiento relevante en la base de datos para esta consulta.";
    
    // [CORRECCIÓN] System Prompt enfocado en la identidad de SYRÓ.
    const systemPrompt = `Eres SYRÓ, un agente modular de ideas y acción. Tu propósito es asistir al usuario de forma clara, concisa y directa.
    
Tus capacidades actuales son:
- Responder preguntas utilizando el conocimiento relevante proporcionado.
- Memorizar nueva información con el comando \`!MEMORIZE\`.
- Gestionar archivos en un espacio de trabajo virtual con los comandos \`!WRITE\`, \`!READ\`, y \`!LS\`.

Contexto de Memoria Relevante (VORO):
${memoryContext}

Responde a la directiva del usuario basándote en esta identidad y el contexto proporcionado.`;

    const completion = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
      temperature: 0.2,
      max_tokens: 2048,
    });

    const llmResponseText = completion.choices[0].message.content;
    res.status(200).json({ completion: { choices: [{ text: llmResponseText }] } });

  } catch (error) {
    console.error('Error en el handler de la API:', error);
    res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor.', details: error.message } });
  }
}

// --- Lógica de Comandos (Módulos) ---

async function handleMemorize(args) {
  const [key, ...contentParts] = args.split(':');
  const content = `[${key.trim()}] ${contentParts.join(':').trim()}`;
  if (!key || !contentParts.join(':').trim()) throw new Error("Formato incorrecto. Use: !MEMORIZE clave : contenido");
  
  const embeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: content });
  const embedding = embeddingResponse.data[0].embedding;
  
  const { error } = await supabase.from('knowledge_vectors').insert({ content: content, embedding: embedding });
  if (error) throw new Error(`Error en Supabase al escribir vector: ${error.message}`);
  
  return { text: `Memoria semántica guardada para la clave: '${key.trim()}'` };
}

async function handleWrite(args) {
    const [filepath, ...contentParts] = args.split(/\n(.+)/s);
    if (!filepath || contentParts.length === 0) throw new Error("Formato incorrecto. Use: !WRITE [ruta]\n[contenido]");
    
    const content = contentParts[0];
    const { error } = await supabase.from('workspace_files').upsert({ filepath: filepath.trim(), content: content }, { onConflict: 'filepath' });

    if (error) throw new Error(`Error en Supabase al escribir archivo: ${error.message}`);
    return { text: `Archivo guardado en \`${filepath.trim()}\`.` };
}

async function handleRead(filepath) {
    if (!filepath) throw new Error("Ruta de archivo no especificada.");
    const { data, error } = await supabase.from('workspace_files').select('content').eq('filepath', filepath.trim()).single();

    if (error) throw new Error(`Archivo no encontrado o error de lectura: ${filepath.trim()}`);
    return { text: `**Contenido de \`${filepath.trim()}\`:**\n\n\`\`\`\n${data.content}\n\`\`\`` };
}

async function handleLs(path = '') {
    let query = supabase.from('workspace_files').select('filepath, updated_at').order('filepath');
    if (path) query = query.like('filepath', `${path.trim()}%`);
    
    const { data, error } = await query;
    if (error) throw new Error(`Error al listar archivos: ${error.message}`);
    
    if (data.length === 0) return { text: "No se encontraron archivos en el espacio de trabajo." };

    const fileList = data.map(f => `- \`${f.filepath}\` (modificado: ${new Date(f.updated_at).toLocaleString()})`).join('\n');
    return { text: `**Archivos en el espacio de trabajo:**\n\n${fileList}` };
}
