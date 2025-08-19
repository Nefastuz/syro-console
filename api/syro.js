// Archivo: api/syro.js (v2.8 - Implementación de /df para Debrief de Sesión)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

// --- Configuración de Clientes ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

// --- Constantes del Modelo ---
const EMBEDDING_MODEL_API_URL = "https://api-inference.huggingface.co/models/Xenova/bge-small-en-v1.5";
const COMPLETION_MODEL = 'llama3-8b-8192'; 
const MATCH_THRESHOLD = 0.7;
const MATCH_COUNT = 10;

// --- Funciones Auxiliares ---
async function generateEmbedding(text) { /* ... (sin cambios) ... */ }
async function getProjectVersion() { /* ... (sin cambios) ... */ }

async function getLatestCommit() {
    return new Promise((resolve, reject) => {
        exec('git log -n 1 --pretty=format:"%h - %s"', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error al ejecutar git log: ${error}`);
                return reject(new Error('No se pudo obtener el último commit.'));
            }
            if (stderr) {
                console.error(`Stderr de git log: ${stderr}`);
            }
            resolve(stdout.trim());
        });
    });
}

// --- Handler Principal ---
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
    const userInput = req.body?.prompt?.text;
    if (!userInput) { return res.status(400).json({ error: { code: 'invalid_request', message: 'MCP request must include a `prompt.text` field.' } }); }

    try {
        const lowerCaseInput = userInput.trim().toLowerCase();

        // --- Flujo de /df (Debrief) ---
        if (lowerCaseInput.startsWith('/df')) {
            const sessionHistory = userInput.substring('/df'.length).trim();
            if (!sessionHistory) {
                return res.status(400).json({ error: { code: 'invalid_arguments', message: "El comando /df requiere que se pegue el historial de la sesión después del comando." } });
            }

            const analysisPrompt = `
Eres un analista de ingeniería de software. Analiza el siguiente historial de sesión de una conversación entre un Arquitecto (Roman) y un Ingeniero de IA (Edu). Tu objetivo es generar un informe de traspaso ("debrief") conciso y preciso.

HISTORIAL DE LA SESIÓN:
---
${sessionHistory}
---

TAREAS:
1.  **Objetivo Alcanzado:** Describe en una frase clara cuál fue el hito principal que se logró en la sesión.
2.  **Análisis de Anomalías:** Identifica los 2-3 patrones de error o ineficiencia más importantes que ocurrieron.
3.  **Lecciones de Ingeniería:** Extrae las lecciones clave aprendidas de estos errores.
4.  **Protocolos Evolucionados:** Lista los nuevos protocolos o ajustes al workflow que se acordaron.
5.  **Vector de Continuidad:** Define claramente cuál es el próximo objetivo estratégico a abordar.

Genera la respuesta directamente en formato Markdown, siguiendo la estructura del archivo 'session_debrief.md'.
`;

            const analysisCompletion = await groq.chat.completions.create({
                model: COMPLETION_MODEL,
                messages: [{ role: 'user', content: analysisPrompt }],
                temperature: 0.1,
            });
            const analysisResult = analysisCompletion.choices[0].message.content;

            const latestCommit = await getLatestCommit();
            const currentDate = new Date().toISOString();

            const debriefReport = `
# Informe de Sesión y Traspaso de Conocimiento (Debrief)

**Fecha de Generación:** ${currentDate}
**Commit de Cierre de Sesión:** 
${latestCommit}
**Autor:** Edu, Chief Systems Architect

---

${analysisResult}
`;
            
            const mcpResponse = { completion: { choices: [{ text: debriefReport.trim() }] } };
            return res.status(200).json(mcpResponse);
        }

        // --- Flujo de /ckp ---
        if (lowerCaseInput === '/ckp') { /* ... (sin cambios) ... */ }

        // --- Flujo de /memorize ---
        if (lowerCaseInput.startsWith('/memorize ')) { /* ... (sin cambios) ... */ }

        // --- Flujo de Consulta (RAG + KHA) ---
        // ... (lógica de consulta RAG sin cambios)

    } catch (error) {
        console.error('Error en el handler de la API:', error);
        res.status(500).json({ error: { code: 'internal_server_error', message: 'Error interno del servidor.', details: error.message } });
    }
}