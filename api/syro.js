// Archivo: api/syro.js (v2.4 - Cabecera Content-Type Corregida)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// --- Configuración de Clientes ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

// --- Constantes del Modelo ---
const EMBEDDING_MODEL_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
const COMPLETION_MODEL = 'llama3-8b-8192'; 
const MATCH_THRESHOLD = 0.7;
const MATCH_COUNT = 10;

// --- Funciones Auxiliares ---
async function generateEmbedding(text) {
    const response = await fetch(
        EMBEDDING_MODEL_API_URL,
        {
            // [CORRECCIÓN] Añadir la cabecera Content-Type que requiere la API de Hugging Face.
            headers: { 
                'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                'Content-Type': 'application/json' 
            },
            method: "POST",
            body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
        }
    );
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error en la API de Embeddings de Hugging Face: ${errorBody}`);
    }
    const data = await response.json();
    return data[0];
}

// --- Handler Principal ---
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
    const userInput = req.body?.prompt?.text;
    if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

    try {
        if (userInput.startsWith('!MEMORIZE')) {
            if (!process.env.HF_TOKEN) {
                throw new Error("La variable de entorno HF_TOKEN es necesaria para la memorización.");
            }
            const contentToMemorize = userInput.replace('!MEMORIZE', '').trim();
            const [key, ...contentParts] = contentToMemorize.split(':');
            const content = `[${key.trim()}] ${contentParts.join(':').trim()}`;
            if (!key || !contentParts.join(':').trim()) { return res.status(400).json({ error: { code: 'invalid_arguments', message: "Formato incorrecto. Use: !MEMORIZE clave : contenido" } }); }
            
            const embedding = await generateEmbedding(content);
            
            const { error } = await supabase.from('knowledge_vectors').insert({ content: content, embedding: embedding });
            if (error) { throw new Error(`Error en Supabase al escribir vector: ${error.message}`); }
            
            const mcpResponse = { completion: { choices: [{ text: `Memoria semántica guardada para la clave: '${key.trim()}'` }] } };
            return res.status(200).json(mcpResponse);
        }

        let memoryContext = "La memoria semántica (VORO) está desactivada porque no se proporcionó una clave de Hugging Face (HF_TOKEN).";

        if (process.env.HF_TOKEN) {
            const queryEmbedding = await generateEmbedding(userInput);

            const { data: matchedKnowledge, error: matchError } = await supabase.rpc('match_knowledge', {
                p_query_embedding: queryEmbedding,
                p_match_threshold: MATCH_THRESHOLD,
                p_match_count: MATCH_COUNT,
            });

            if (matchError) {
                throw new Error(`Error en RPC match_knowledge: ${matchError.message}`);
            }

            memoryContext = matchedKnowledge && matchedKnowledge.length > 0
                ? matchedKnowledge.map(k => `- ${k.content}`).join('\n')
                : "No se encontró conocimiento relevante en la memoria para esta consulta.";
        }
        
        const systemPrompt = `Eres SYRÓ, un agente de IA. Responde de forma concisa y directa. Utiliza el siguiente conocimiento recuperado de tu memoria a largo plazo para informar tu respuesta:\n\n--- INICIO DE MEMORIA ---\n${memoryContext}\n--- FIN DE MEMORIA ---`;

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
        console.error('Error en el handler de la API:', error);
        res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor.', details: error.message } });
    }
}
