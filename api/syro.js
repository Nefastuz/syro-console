// Archivo: api/syro.js (v2.7 - Prefijos de Comando '/' implementados)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

// --- Configuración de Clientes ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

// --- Constantes del Modelo ---
const EMBEDDING_MODEL_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/Xenova/bge-small-en-v1.5";
const COMPLETION_MODEL = 'llama3-8b-8192'; 
const MATCH_THRESHOLD = 0.7;
const MATCH_COUNT = 10;

// --- Funciones Auxiliares ---
async function generateEmbedding(text) {
    const response = await fetch(
        EMBEDDING_MODEL_API_URL,
        {
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
        console.error("Error detallado de la API de Hugging Face:", errorBody);
        throw new Error(`Error en la API de Embeddings de Hugging Face: ${errorBody}`);
    }
    const data = await response.json();
    return data[0];
}

async function getProjectVersion() {
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJsonData = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonData);
        return packageJson.version || 'No especificada';
    } catch (error) {
        console.error("Error al leer package.json:", error);
        return 'Desconocida';
    }
}

// --- Handler Principal ---
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
    const userInput = req.body?.prompt?.text;
    if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

    try {
        const lowerCaseInput = userInput.trim().toLowerCase();

        // --- Flujo de /ckp v2.0 ---
        if (lowerCaseInput === '/ckp') {
            const version = await getProjectVersion();
            const { data: recentMemories, error: memoryError } = await supabase
                .from('knowledge_vectors')
                .select('content')
                .order('created_at', { ascending: false })
                .limit(5);

            if (memoryError) {
                throw new Error(`Error al recuperar memorias recientes: ${memoryError.message}`);
            }

            const recentKnowledge = recentMemories.map(m => `- ${m.content.substring(0, 150)}...`).join('\n');

            const report = `
# Punto de Control SYRÓ v${version} (Auto-generado)

## SECCIÓN 1: ESTADO ACTUAL

**Versión del Sistema:** ${version}
**Estado del Módulo KHA (Creatividad):** Operativo (Groq - ${COMPLETION_MODEL})
**Estado del Módulo VORO (Memoria):** Operativo (Hugging Face Embeddings)

## SECCIÓN 2: CONOCIMIENTO RECIENTE

A continuación se muestran los 5 fragmentos de conocimiento más recientes añadidos a la memoria semántica:

${recentKnowledge}

## SECCIÓN 3: DIRECTIVA DE GUARDADO

Por favor, copie el contenido de este informe y guárdelo como un nuevo archivo .md en el directorio 
_ckp_archive_ para mantener la integridad del legado del proyecto.
`;
            
            const mcpResponse = { completion: { choices: [{ text: report.trim() }] } };
            return res.status(200).json(mcpResponse);
        }

        // --- Flujo de /memorize ---
        if (lowerCaseInput.startsWith('/memorize ')) {
            if (!process.env.HF_TOKEN) {
                throw new Error("La variable de entorno HF_TOKEN es necesaria para la memorización.");
            }
            const contentToMemorize = userInput.substring('/memorize'.length).trim();
            const [key, ...contentParts] = contentToMemorize.split(':');
            const content = `[${key.trim()}] ${contentParts.join(':').trim()}`;
            if (!key || !contentParts.join(':').trim()) { return res.status(400).json({ error: { code: 'invalid_arguments', message: "Formato incorrecto. Use: /memorize clave : contenido" } }); }
            
            const embedding = await generateEmbedding(content);
            
            const { error } = await supabase.from('knowledge_vectors').insert({ content: content, embedding: embedding });
            if (error) { throw new Error(`Error en Supabase al escribir vector: ${error.message}`); }
            
            const mcpResponse = { completion: { choices: [{ text: `Memoria semántica guardada para la clave: '${key.trim()}'` }] } };
            return res.status(200).json(mcpResponse);
        }

        // --- Flujo de Consulta (RAG + KHA) ---
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