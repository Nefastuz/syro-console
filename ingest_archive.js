// Archivo: ingest_archive.js (v1.3 - Cabecera Content-Type Corregida)
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// --- Configuración ---
const ARCHIVE_PATH = path.join(process.cwd(), '_ckp_archive');
const EMBEDDING_MODEL_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.HF_TOKEN) {
    console.error("Error: Asegúrate de que las variables de entorno SUPABASE_URL, SUPABASE_ANON_KEY, y HF_TOKEN están definidas en tu archivo .env");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- Funciones ---

async function generateEmbeddings(texts) {
    const response = await fetch(
        EMBEDDING_MODEL_API_URL,
        {
            // [CORRECCIÓN] Añadir la cabecera Content-Type que requiere la API de Hugging Face.
            headers: { 
                'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
        }
    );
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error en la API de Embeddings de Hugging Face: ${errorBody}`);
    }
    return await response.json();
}

function chunkText(text, fileName) {
    if (fileName === '000_constitution.md') {
        return [`[Fuente: ${fileName}] ${text.trim()}`];
    }
    const sections = text.split(/SECCIÓN \d+/);
    const chunks = [];
    for (const section of sections) {
        if (section.trim().length < 100) continue;
        const paragraphs = section.split(/\n\s*\n/);
        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            if (trimmedParagraph.length > 200) {
                chunks.push(`[Fuente: ${fileName}] ${trimmedParagraph}`);
            }
        }
    }
    return chunks;
}

async function processFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\n--- Procesando archivo: ${fileName} ---
`);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const chunks = chunkText(content, fileName);

        if (chunks.length === 0) {
            console.log(`No se encontraron fragmentos significativos. Saltando.`);
            return;
        }

        console.log(`  Se encontraron ${chunks.length} fragmentos. Generando embeddings en lotes...
`);
        
        const batchSize = 50;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            const embeddings = await generateEmbeddings(batchChunks);
            
            if (!Array.isArray(embeddings) || embeddings.length !== batchChunks.length) {
                throw new Error('La respuesta de la API de embeddings no tiene el formato esperado.');
            }

            const vectors = batchChunks.map((chunk, j) => ({
                content: chunk,
                embedding: embeddings[j],
            }));

            console.log(`  Insertando lote ${Math.floor(i / batchSize) + 1} (${vectors.length} vectores) en la base de datos...
`);
            const { error } = await supabase.from('knowledge_vectors').insert(vectors);

            if (error) {
                console.error(`    Error en el lote:`, error.message);
            } else {
                console.log(`    Lote insertado con éxito.
`);
            }
        }
        console.log(`--- Archivo ${fileName} procesado con éxito ---
`);
    } catch (error) {
        console.error(`Error al procesar el archivo ${fileName}:`, error);
    }
}

async function main() {
    console.log("======================================================");
    console.log("== Iniciando el proceso de ingesta de conocimiento ==");
    console.log("======================================================");
    try {
        console.log("Limpiando conocimiento previo de la base de datos...");
        const { error: deleteError } = await supabase.from('knowledge_vectors').delete().neq('id', 0);
        if (deleteError) throw new Error(`No se pudo limpiar la tabla: ${deleteError.message}`);
        console.log("Conocimiento previo eliminado.");

        const files = await fs.readdir(ARCHIVE_PATH);
        const markdownFiles = files.filter(file => file.endsWith('.md'));
        
        const constitutionIndex = markdownFiles.indexOf('000_constitution.md');
        if (constitutionIndex > -1) {
            const constitutionFile = markdownFiles.splice(constitutionIndex, 1)[0];
            await processFile(path.join(ARCHIVE_PATH, constitutionFile));
        } else {
            console.warn("ADVERTENCIA: No se encontró el archivo de constitución (000_constitution.md).");
        }

        console.log(`Se encontraron ${markdownFiles.length} archivos de legado para procesar.
`);

        for (const file of markdownFiles) {
            await processFile(path.join(ARCHIVE_PATH, file));
        }

        console.log("\n======================================================");
        console.log("== Proceso de ingesta completado.                 ==");
        console.log("======================================================");
    } catch (error) {
        console.error("Fallo catastrófico durante la ingesta:", error);
    }
}

main();
