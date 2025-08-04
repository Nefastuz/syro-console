// Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');
const { PredictionServiceClient } = require('@google-cloud/aiplatform');
const {fromObject} = require('@google-cloud/aiplatform/helpers');

// Inicializar el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPER DE INFRAESTRUCTURA: Parseador del Body ---
// En Vercel Serverless, el body de un POST debe leerse manualmente del stream.
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Solo intentar parsear si el body no está vacío
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error("Cuerpo de la solicitud con JSON mal formado."));
            }
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
}

// --- NÚCLEO: Handler Principal de la API (NAOS) ---
module.exports = async (req, res) => {
    // Configuración de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Usar nuestro helper para obtener el body
        const body = await parseBody(req);
        const command = body.command;

        if (!command) {
            throw new Error("El campo 'command' no se encontró en el cuerpo de la solicitud JSON.");
        }

        await logEvent('CommandReceived', `Comando: ${command}`, 'handler');
        const result = await processCommand(command);
        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error("Error en el handler principal:", error.stack);
        await logEvent('Error', error.message, 'handler');
        res.status(500).json({ success: false, error: error.message });
    }
};

// --- LÓGICA: Procesador de Comandos (NAOS) ---
async function processCommand(command) {
    const { action, params } = parseCommand(command);
    await logEvent('ProcessingCommand', `Acción: ${action}, Parámetros: ${JSON.stringify(params)}`, 'processCommand');

    switch (action) {
        case 'ADD_PROJECT':
            return await addProject(params);
        
        case 'CREATE_CLICKUP_TASK':
            return await createClickUpTask(params);

        case 'ASK_SYRO':
            return await callGeminiAPI(params);

        default:
            throw new Error(`Acción desconocida: ${action}`);
    }
}

// --- UTILIDADES: Parseador de Comandos (Protocolo MCP) ---
function parseCommand(commandString) {
    const parts = commandString.split('::');
    const action = parts.shift();
    const params = {};
    parts.forEach(part => {
        const [key, value] = part.split('=');
        params[key] = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
    });
    return { action, params };
}

// --- MÓDULO DE PERSISTENCIA: Funciones de Supabase (MOS y VORO) ---
async function addProject(params) {
    if (!params.NAME) throw new Error("El parámetro NAME es obligatorio para ADD_PROJECT.");
    const { data, error } = await supabase
        .from('projects')
        .insert([{ project_name: params.NAME, description: params.DESCRIPTION || null }])
        .select();
    if (error) {
        await logEvent('SupabaseError', `Error al insertar proyecto: ${error.message}`, 'addProject');
        throw new Error(`Error en Supabase (addProject): ${error.message}`);
    }
    await logEvent('ProjectAdded', `Proyecto '${params.NAME}' añadido con éxito.`, 'addProject');
    return data;
}

// --- MÓDULO DE LOGGING (VORO) ---
async function logEvent(type, description, source) {
    const { error } = await supabase
        .from('system_log')
        .insert([{ event_type: type, description: description, function_source: source }]);
    if (error) {
        console.error(`Fallo al registrar evento en Supabase: ${error.message}`);
    }
}

// --- MÓDULO DE ACCIÓN: API de ClickUp (LUMA) ---
async function createClickUpTask(params) {
    if (!params.TASK_NAME) throw new Error("El parámetro TASK_NAME es obligatorio para CREATE_CLICKUP_TASK.");
    const listId = process.env.DEFAULT_LIST_ID;
    const token = process.env.CLICKUP_TOKEN;
    const url = `https://api.clickup.com/api/v2/list/${listId}/task`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ name: params.TASK_NAME, description: params.DESCRIPTION || "" })
    });
    if (!response.ok) {
        const errorData = await response.json();
        await logEvent('ClickUpError', `Error al crear tarea: ${JSON.stringify(errorData)}`, 'createClickUpTask');
        throw new Error(`Error en la API de ClickUp: ${response.statusText}`);
    }
    const data = await response.json();
    await logEvent('ClickUpTaskCreated', `Tarea '${params.TASK_NAME}' creada con ID: ${data.id}`, 'createClickUpTask');
    return data;
}

async function callGeminiAPI(params) {
    if (!params.PROMPT) throw new Error('El parámetro PROMPT es obligatorio para ASK_SYRO.');
    
    await logEvent('VertexAICall', `Llamando a Vertex AI con: ${params.PROMPT}`, 'callGeminiAPI');

    const clientOptions = {
        apiEndpoint: 'us-central1-aiplatform.googleapis.com'
    };
    const predictionServiceClient = new PredictionServiceClient(clientOptions);

    const project = 'syro-467919';
    const location = 'us-central1';
    const model = 'gemini-1.0-pro';
    const endpoint = `projects/${project}/locations/${location}/publishers/google/models/${model}`;

    const instances = [fromObject({ content: { parts: [{ text: params.PROMPT }] } })];
    const parameters = fromObject({
        temperature: 0.5,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
    });

    const request = {
        endpoint,
        instances,
        parameters,
    };

    try {
        const [response] = await predictionServiceClient.predict(request);
        const prediction = response.predictions[0];
        const extractedText = prediction.structValue.fields.content.structValue.fields.parts.listValue.values[0].structValue.fields.text.stringValue;
        
        await logEvent('VertexAISuccess', 'Respuesta de Vertex AI recibida', 'callGeminiAPI');
        return { success: true, responseText: extractedText };
    } catch (error) {
        console.error('Error al llamar a la API de Vertex AI:', error);
        await logEvent('VertexAIError', `Fallo en la llamada a Vertex AI: ${error.message}`, 'callGeminiAPI');
        throw new Error(`Error en la API de Vertex AI: ${error.message}`);
    }
}