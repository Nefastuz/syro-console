// Archivo: debrief.js
// Propósito: Un script de desarrollo local para analizar un historial de sesión y actualizar el session_debrief.md.
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { exec } from 'child_process';

// --- Configuración ---
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
const COMPLETION_MODEL = 'llama3-8b-8192';
const HISTORY_FILE_PATH = 'session.log'; // Archivo donde se pega el historial
const DEBRIEF_FILE_PATH = '_ckp_archive/session_debrief.md';

// --- Funciones ---

function getLatestCommit() {
    return new Promise((resolve, reject) => {
        exec('git log -n 1 --pretty=format:"%h - %s"', (error, stdout) => {
            if (error) {
                console.error(`Error al ejecutar git log: ${error}`);
                return reject(new Error('No se pudo obtener el último commit.'));
            }
            resolve(stdout.trim());
        });
    });
}

async function getProjectVersion() {
    try {
        const packageJsonData = await fs.readFile('package.json', 'utf-8');
        return JSON.parse(packageJsonData).version || 'No especificada';
    } catch (error) {
        console.error("Error al leer package.json:", error);
        return 'Desconocida';
    }
}

async function main() {
    console.log("--- Iniciando análisis de sesión para el informe de traspaso ---");
    try {
        // 1. Leer el historial de la sesión
        console.log(`Leyendo historial desde ${HISTORY_FILE_PATH}...`);
        const sessionHistory = await fs.readFile(HISTORY_FILE_PATH, 'utf-8');
        if (!sessionHistory) {
            throw new Error(`El archivo ${HISTORY_FILE_PATH} está vacío o no se encontró.`);
        }

        // 2. Preparar y enviar el prompt de análisis al LLM
        console.log("Enviando historial al LLM para análisis...");
        const analysisPrompt = `
Eres un analista de ingeniería de software. Analiza el siguiente historial de sesión de una conversación entre un Arquitecto (Roman) y un Ingeniero de IA (Edu). Tu objetivo es generar un informe de traspaso ("debrief") conciso y preciso.

HISTORIAL DE LA SESIÓN:
---
${sessionHistory}
---

TAREAS DEL ANÁLISis:
1.  **Objetivo Alcanzado:** Describe en una frase clara cuál fue el hito principal que se logró en la sesión.
2.  **Análisis de Anomalías:** Identifica los 2-3 patrones de error o ineficiencia más importantes que ocurrieron.
3.  **Lecciones de Ingeniería:** Extrae las lecciones clave aprendidas de estos errores.
4.  **Protocolos Evolucionados:** Lista los nuevos protocolos o ajustes al workflow que se acordaron.
5.  **Vector de Continuidad:** Define claramente cuál es el próximo objetivo estratégico a abordar.

Genera la respuesta directamente en formato Markdown, empezando por la sección