// Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// Inicializar el cliente de Supabase con las variables de entorno
// Estas credenciales son seguras porque se gestionan en Vercel, no en el código.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- NÚCLEO: Handler Principal de la API (NAOS) ---
module.exports = async (req, res) => {
    // Permitir CORS para que el frontend pueda llamar a la API
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Manejar solicitudes OPTIONS (pre-flight) para CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // --- Parseo de JSON ---
    // Vercel no parsea el body automáticamente. Este bloque lo soluciona.
    if (req.method === 'POST' && typeof req.body !== 'object') {
        try {
            // req.body llega como un string, necesitamos convertirlo a JSON.
            req.body = JSON.parse(req.body); 
        } catch (e) {
            // Si el cuerpo no es JSON válido, el frontend está enviando mal los datos.
            return res.status(400).json({ success: false, error: 'Cuerpo de la solicitud mal formado.' });
        }
    }
    // --- Fin del Bloque de Corrección ---

    try {
        const command = req.body.command;
        if (!command) {
            // Ahora, si el comando no existe, es porque no se envió en el JSON.
            throw new Error("El campo 'command' no se encontró en el cuerpo de la solicitud JSON.");
        }

        // Registrar el evento de comando recibido en la base de datos (VORO)
        await logEvent('CommandReceived', `Comando: ${command}`, 'handler');

        // Procesar el comando y obtener el resultado
        const result = await processCommand(command);

        // Enviar respuesta exitosa
        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error("Error en el handler principal:", error);
        // Registrar el error en la base de datos (VORO)
        await logEvent('Error', error.message, 'handler');
        // Enviar respuesta de error
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

        // Aquí se pueden añadir más casos para otras acciones como ASK_SYRO, EXECUTE_CHAIN, etc.
        // Por ahora, nos centramos en las funciones que interactúan con la nueva DB y las APIs externas.

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
        // Quita las comillas del valor
        params[key] = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
    });
    return { action, params };
}


// --- MÓDULO DE PERSISTENCIA: Funciones de Supabase (MOS y VORO) ---

// Función para añadir un proyecto a la tabla 'projects' (MOS)
async function addProject(params) {
    if (!params.NAME) throw new Error("El parámetro NAME es obligatorio para ADD_PROJECT.");

    const { data, error } = await supabase
        .from('projects')
        .insert([{
            project_name: params.NAME,
            description: params.DESCRIPTION || null // Permite descripción opcional
        }])
        .select(); // .select() devuelve el registro insertado

    if (error) {
        await logEvent('SupabaseError', `Error al insertar proyecto: ${error.message}`, 'addProject');
        throw new Error(`Error en Supabase (addProject): ${error.message}`);
    }
    
    await logEvent('ProjectAdded', `Proyecto '${params.NAME}' añadido con éxito.`, 'addProject');
    return data;
}

// Función para registrar eventos en la tabla 'system_log' (VORO)
async function logEvent(type, description, source) {
    const { error } = await supabase
        .from('system_log')
        .insert([{
            event_type: type,
            description: description,
            function_source: source
        }]);

    if (error) {
        // No lanzamos un error aquí para no entrar en un bucle infinito si la DB falla.
        // Simplemente lo registramos en la consola del servidor.
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
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            name: params.TASK_NAME,
            description: params.DESCRIPTION || ""
        })
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