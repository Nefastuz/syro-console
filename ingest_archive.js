// Archivo: ingest_archive.js
// Propósito: Leer todos los archivos de _ckp_archive, generar embeddings localmente y guardarlos en Supabase.
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@huggingface/transformers';

// --- Configuración ---
const ARCHIVE_PATH = path.join(process.cwd(), '_ckp_archive');
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("Error: Asegúrate de que las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY están definidas en tu archivo .env");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- Cache para el Pipeline de Embeddings ---
let extractor = null;
class EmbeddingPipeline {
    static async getInstance() {
        if (this.instance === null) {
            console.log("Inicializando pipeline de embeddings por primera vez. Esto puede tardar...");
            this.instance = await pipeline('feature-extraction', EMBEDDING_MODEL);
            console.log("Pipeline listo.");
        }
        return this.instance;
    }
}
EmbeddingPipeline.instance = null;

// --- Funciones ---

async function generateEmbedding(text) {
    const extractor = await EmbeddingPipeline.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

function chunkText(text, fileName) {
    const sections = text.split(/SECCIÓN \d+/);
    const chunks = [];
    for (const section of sections) {
        if (section.trim().length < 100) continue;
        const paragraphs = section.split(/\n\s*\n/);
        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            if (trimmedParagraph.length > 200) { // Solo indexar párrafos sustanciales
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

        console.log(`  Se encontraron ${chunks.length} fragmentos. Generando embeddings...
`);
        
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            const embeddings = await Promise.all(batchChunks.map(chunk => generateEmbedding(chunk)));
            
            const vectors = batchChunks.map((chunk, j) => ({
                content: chunk,
                embedding: embeddings[j],
            }));

            console.log(`  Insertando lote ${i / batchSize + 1} (${vectors.length} vectores) en la base de datos...
`);
            const { error } = await supabase.from('knowledge_vectors').insert(vectors);

            if (error) {
                console.error(`    Error en el lote:`, error.message);
            } else {
                console.log(`    Lote insertado con éxito.`);
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
        const files = await fs.readdir(ARCHIVE_PATH);
        const markdownFiles = files.filter(file => file.endsWith('.md'));

        console.log(`Se encontraron ${markdownFiles.length} archivos .md para procesar.
`);
        
        await EmbeddingPipeline.getInstance();

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
