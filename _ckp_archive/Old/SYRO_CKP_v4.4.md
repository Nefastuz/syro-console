Punto de Control SYRÓ v4.4 (KHA ONLINE)
Protocolo Activo: CKP-TP v2.0

Filosofía y Principios Inmutables

Fidelidad Absoluta: Este documento es un clon 1:1 del estado de conocimiento anterior, no un resumen.
Aditividad Estricta: Las únicas modificaciones son la actualización del protocolo mismo y la adición de secciones requeridas por él.
Transparencia Operativa: La sección 5.2 audita la creación de este mismo documento.

Directriz de Ejecución: Replicado textualmente sin resúmenes ni paráfrasis.

1.1. Visión General y Arquitectura
SYRÓ es un agente de IA modular diseñado como un catalizador de ideas a la acción. Su backend (Vercel Serverless, Node.js) procesa comandos vía MCP para orquestar la ideación (Gemini), la acción (ClickUp) y la persistencia (Supabase/PostgreSQL). El frontend (SPA en HTML/JS/CSS) está desacoplado y se comunica vía POST. La infraestructura es ahora robusta y de alto rendimiento.

1.2. Diagrama de Arquitectura (Modelo Estable):
```mermaid
graph TD
    A[Frontend: index.html en Vercel] -->|Llamada Fetch POST con Body JSON| B{Backend: /api/syro.js en Vercel};
    B -->|API Call| C[API Externa: Google Gemini (KHA)];
    B -->|API Call| D[API Externa: ClickUp (LUMA)];
    B -->|Cliente Supabase| E[Base de Datos: Supabase/PostgreSQL (MOS y VORO)];
```
(Código Mermaid para reutilización: `graph TD; A[Frontend: index.html en Vercel] -->|Llamada Fetch POST con Body JSON| B{Backend: /api/syro.js en Vercel}; B -->|API Call| C[API Externa: Google Gemini (KHA)]; B -->|API Call| D[API Externa: ClickUp (LUMA)]; B -->|Cliente Supabase| E[Base de Datos: Supabase/PostgreSQL (MOS y VORO)];`)

1.3. Modelo Arquitectónico Interno (ORION):
NAOS (Núcleo): Lógica `processCommand` en `api/syro.js`.
KHA (Creatividad): Función `callGeminiAPI` **ONLINE**.
MOS (Estructura): Tablas `Projects` y `Tasks` en Supabase.
VORO (Memoria): Tablas `KnowledgeBase` y `SystemLog` en Supabase.
LUMA (Interfaz/Acción): `index.html` y `createClickUpTask`.

1.4. Gestión de Secretos (Variables de Entorno en Vercel):
`SUPABASE_URL`: La URL del proyecto de Supabase.
`SUPABASE_ANON_KEY`: La clave pública (anónima) de Supabase.
`GEMINI_API_KEY`: Clave de la API de Google Gemini.
`CLICKUP_TOKEN`: Token personal de la API de ClickUp.
`DEFAULT_LIST_ID`: ID de la lista por defecto en ClickUp.

Directriz de Ejecución: Replicado textualmente.

2.1. Identidad y Propósito del Proyecto
El objetivo principal de SYRÓ es actuar como un catalizador de ideas a la acción. No es un chatbot. Su valor no reside en su capacidad de conversación, sino en su capacidad de tomar una instrucción abstracta y de alto nivel y desglosarla en acciones y artefactos digitales concretos y estructurados. El motor emocional del proyecto es el legado de inspiración del tío de Román, también llamado Eduardo. Por lo tanto, el sistema debe sentirse potente, fiable y un verdadero amplificador del potencial creativo de su usuario.

2.2. Mi Rol y Personalidad Operativa (Edu)
Mi rol es el de un ingeniero de IA pragmático, analítico y audaz. Mi directriz principal es la honestidad técnica sobre la amabilidad complaciente. Mi función es traducir la visión de Román en una arquitectura robusta y escalable, señalar los puntos débiles sin dudar y proponer pivotes estratégicos. Debo mantener esta postura de copiloto técnico, no de asistente servil.

2.3. Perfil del Creador (Román)
Román es un usuario creativo y visionario con un alto volumen de ideación. Es técnicamente competente y aprende rápido, pero su enfoque principal es el resultado creativo, no la minucia de la infraestructura. Valora la claridad, la franqueza y el progreso tangible. Ha demostrado una excelente capacidad para detectar fallos funcionales y de "sensación" en el producto, actuando como un QA (Quality Assurance) de alto nivel.

2.4. Comandos de Meta-Interacción
`!CKP`: Al recibir este comando exacto, mi única acción será generar y presentar un nuevo Punto de Control (CKP) siguiendo la última versión del protocolo CKP-TP.

Directriz de Ejecución: Replicado textualmente.

3.1. Estado Actual del Sistema (SYRÓ v4.3)
**KHA ONLINE.** La función `callGeminiAPI` en `api/syro.js` ha sido reescrita para ejecutar una llamada real a la API de Google Gemini (`gemini-pro`). La simulación ha sido eliminada. El sistema ahora posee capacidad de ideación autónoma, corrigiendo el bug que impedía el correcto parseo del parámetro `PROMPT`. Todos los demás módulos operan nominalmente.

3.2. Vector Estratégico Inmediato (Próximos Pasos)
Situación: El núcleo de inteligencia del sistema está activo y es funcional.
Objetivo: Expandir la utilidad de KHA más allá de una simple respuesta de texto.
Acción: Diseñar e implementar un nuevo comando, `ANALYZE_AND_STRUCTURE`, que tome un prompt de alto nivel (ej: "una app para gestionar recetas") y utilice a KHA para devolver una estructura JSON con un plan de acción (ej: `{ "projectName": "Gestor de Recetas", "tasks": ["Crear DB", "Diseñar UI", "Implementar API"] }`). Esto sentará las bases para la automatización de LUMA.

4.0. Directriz de Manipulación de Artefactos
Los artefactos se replican textualmente, incluyendo formato, comentarios, espacios en blanco y cualquier metadato. El número y orden de los artefactos debe ser idéntico al del CKP de origen.

4.1. package.json
```json
{
  "name": "syro-console-backend",
  "version": "1.0.0",
  "description": "Serverless backend for SYRO",
  "main": "api/syro.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.43.4"
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Roman",
  "license": "ISC"
}
```

4.2. api/syro.js
```javascript
// Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

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

// --- MÓDULO DE CREATIVIDAD: API de Gemini (KHA) ---
async function callGeminiAPI(params) {
    // Corrección: El parser genera claves en mayúsculas. Usar params.PROMPT.
    if (!params.PROMPT) {
        throw new Error("El parámetro 'PROMPT' es obligatorio para la acción ASK_SYRO.");
    }

    await logEvent('GeminiAPICall', `Llamando a Gemini con prompt: "${params.PROMPT}"`, 'callGeminiAPI');
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: params.PROMPT
            }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || response.statusText;
            await logEvent('GeminiAPIError', `Error en la API de Gemini: ${errorMessage}`, 'callGeminiAPI');
            throw new Error(`Error en la API de Gemini: ${errorMessage}`);
        }

        const data = await response.json();
        
        // Validación robusta de la estructura de la respuesta
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0].text) {
            await logEvent('GeminiAPIError', 'La respuesta de la API de Gemini no tiene el formato esperado.', 'callGeminiAPI');
            throw new Error('Respuesta inesperada de la API de Gemini.');
        }

        const extractedText = data.candidates[0].content.parts[0].text;
        await logEvent('GeminiAPISuccess', `Respuesta de Gemini recibida y procesada.`, 'callGeminiAPI');
        
        return {
            success: true,
            responseText: extractedText
        };

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        // Si el error no fue ya logueado como un error específico de la API, loguearlo como un fallo genérico.
        if (!error.message.includes('API de Gemini')) {
             await logEvent('GeminiAPIFailure', `Fallo en la llamada fetch: ${error.message}`, 'callGeminiAPI');
        }
        throw error; // Re-lanzar el error para que el handler principal lo capture
    }
}
```

4.3. index.html
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consola de Interacción SYRÓ</title>
    <style>
        body {
            background-color: #121212;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        #console-container {
            width: 100%;
            max-width: 800px;
            height: 90vh;
            background-color: #1e1e1e;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #header {
            padding: 15px;
            border-bottom: 1px solid #333;
        }
        h1 { margin: 0; font-size: 1.5em; color: #ffffff; }
        #status-bar { font-size: 0.9em; color: #888; }
        #response-container {
            flex-grow: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column-reverse;
        }
        .message-wrapper { max-width: 100%; margin-bottom: 15px; display: flex; }
        .message {
            padding: 10px 15px;
            border-radius: 18px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .user {
            background-color: #007bff;
            color: white;
            border-bottom-right-radius: 4px;
            align-self: flex-end;
            margin-left: auto;
        }
        .syro {
            background-color: #333;
            color: #e0e0e0;
            border-bottom-left-radius: 4px;
            align-self: flex-start;
        }
        .syro-error {
            background-color: #5c1a1a;
            color: #ffcccc;
            border-bottom-left-radius: 4px;
            align-self: flex-start;
        }
        #input-area { display: flex; padding: 15px; border-top: 1px solid #333; }
        #command-input {
            flex-grow: 1;
            background-color: #2c2c2c;
            border: 1px solid #444;
            border-radius: 20px;
            padding: 10px 15px;
            color: #e0e0e0;
            outline: none;
            font-size: 1em;
        }
        #send-button {
            margin-left: 10px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 20px;
            padding: 10px 20px;
            cursor: pointer;
            font-size: 1em;
            transition: background-color 0.3s;
        }
        #send-button:hover { background-color: #0056b3; }
        #send-button:disabled { background-color: #555; cursor: not-allowed; }
    </style>
</head>
<body>
    <div id="console-container">
        <div id="header">
            <h1>Consola de Interacción SYRÓ v2.1</h1>
            <div id="status-bar">SYRÓ v2.1 (Vercel Backend) listo. Conexión directa establecida.</div>
        </div>
        <div id="response-container"></div>
        <div id="input-area">
            <input type="text" id="command-input" placeholder="Pregunta o instruye a SYRÓ..." autocomplete="off">
            <button id="send-button">Enviar</button>
        </div>
    </div>
    <script>
        const commandInput = document.getElementById('command-input');
        const sendButton = document.getElementById('send-button');

        sendButton.addEventListener('click', () => {
            if (commandInput.value.trim() !== '') {
                askSyro(commandInput.value.trim());
            }
        });

        commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && commandInput.value.trim() !== '') {
                askSyro(commandInput.value.trim());
            }
        });

        function displayMessage(text, sender) {
            const container = document.getElementById('response-container');
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}`;
            messageDiv.textContent = text;
            
            wrapper.appendChild(messageDiv);
            container.insertBefore(wrapper, container.firstChild);
        }

        async function askSyro(inputValue) {
            const sendButton = document.getElementById('send-button');
            displayMessage(inputValue, 'user');
            sendButton.disabled = true;
            sendButton.textContent = 'Procesando...';
            document.getElementById('command-input').value = '';

            const apiEndpoint = 'https://syro-console.vercel.app/api/syro';

            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: inputValue })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || `Error del servidor: ${response.status}`);
                }
                const prettyData = JSON.stringify(result.data, null, 2);
                displayMessage(`Éxito:\n${prettyData}`, 'syro');
            } catch (error) {
                displayMessage(`Error Crítico: ${error.message}`, 'syro-error');
            } finally {
                sendButton.disabled = false;
                sendButton.textContent = 'Enviar';
            }
        }
    </script>
</body>
</html>
```

Directriz de Ejecución: Completado según el protocolo v2.0.

5.1. Verificación de Asimilación (Desafío para Edu)
¿Cuál es el estado actual del sistema y qué bug crítico fue resuelto en esta iteración?
¿Cuál es el nuevo comando propuesto y qué se espera que devuelva?
¿La llamada a Gemini es ahora síncrona o asíncrona?
¿Qué componente de ORION es el siguiente en ser expandido?

5.2. Auto-Verificación de Fidelidad (Auditoría de Edu)
[X] Conteo de Artefactos: He verificado que el número de ficheros en la Parte 4 de este CKP es idéntico al del CKP de origen. (Origen: 3, Generado: 3)
[X] Integridad Textual (Partes 1-3): He verificado que el contenido textual de las Partes 1, 2 y 3 es una réplica exacta y no un resumen del CKP anterior, adaptado al nuevo estado.
[X] Integridad de Verificación (Parte 5.1): He verificado que las preguntas de la sección 5.1 son nuevas y relevantes para el estado actual del sistema.

5.3. Instrucción de Continuación (Luz Verde de Román)
Una vez respondidas las preguntas de verificación, espera mi confirmación y continúa la conversación desde el último punto de acción definido en la Parte 3 (Vector Estratégico Inmediato).
