// Archivo: api/syro.js (v2.6 - Implementación de !CKP v2.0)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

// --- Configuración de Clientes ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

// --- Constantes del Modelo ---
const EMBEDDING_MODEL_API_URL = "https://api-inference.huggingface.co/models/Xenova/bge-small-en-v1.5";
const COMPLETION_MODEL = 'llama3-8b-8192'; 
const MATCH_THRESHOLD = 0.7;
const MATCH_COUNT = 10;

// --- Funciones Auxiliares ---
async function generateEmbedding(text) {
    // ... (código de generateEmbedding sin cambios)
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
        // --- Flujo de !CKP v2.0 ---
        if (userInput.trim() === '!CKP') {
            const version = await getProjectVersion();
            const { data: recentMemories, error: memoryError } = await supabase
                .from('knowledge_vectors')
                .select('content')
                .order('id', { ascending: false })
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

        // --- Flujo de !MEMORIZE ---
        if (userInput.startsWith('!MEMORIZE')) {
            // ... (lógica de !MEMORIZE sin cambios)
        }

        // --- Flujo de Consulta (RAG + KHA) ---
        // ... (lógica de consulta RAG sin cambios)

    } catch (error) {
        console.error('Error en el handler de la API:', error);
        res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor.', details: error.message } });
    }
}