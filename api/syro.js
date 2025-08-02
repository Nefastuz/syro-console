const { GoogleSpreadsheet } = require('google-spreadsheet');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const DEFAULT_LIST_ID = process.env.DEFAULT_LIST_ID;

const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
let isAuthLoaded = false;

async function authAndLoadSheets() {
    if (isAuthLoaded) return;
    await doc.useServiceAccountAuth({
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    });
    await doc.loadInfo();
    isAuthLoaded = true;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const command = req.query.cmd;
        if (!command) throw new Error('Parámetro "cmd" no encontrado.');
        const parts = command.split('::');
        const action = parts[0].trim().toUpperCase();
        const paramsString = parts.slice(1).join('::');
        const params = parseParameters(paramsString);
        const result = await processCommand(action, params);
        res.status(200).json(result);
    } catch (error) {
        await logSystemEvent('ERROR', `Handler Error: ${error.message} \nStack: ${error.stack}`, 'handler');
        res.status(500).json({ status: 'error', message: error.message });
    }
};

async function processCommand(action, params) {
    await logSystemEvent('INFO', `Acción: ${action}`, 'processCommand');
    switch (action) {
        case 'ADD_PROJECT': return { status: 'success', data: await addProject(params) };
        case 'CREATE_CLICKUP_TASK': return { status: 'success', data: await createClickUpTask(params) };
        case 'ASK_SYRO': return { status: 'success', data: await askSyro(params) };
        case 'EXECUTE_CHAIN': return { status: 'success', data: await executeChain(params) };
        default: throw new Error(`Acción desconocida: ${action}`);
    }
}

async function askSyro(params) {
    const userPrompt = params.PROMPT;
    if (!userPrompt) throw new Error("ASK_SYRO requiere PROMPT.");
    const mode = (params.MODE || 'SYNTESIS').toUpperCase();

    const memoryResult = await findSemanticMatch(userPrompt, mode);
    if (memoryResult) {
        return `[Respuesta recuperada de mi memoria VORO (Modo ${mode})]:\n\n${memoryResult.information}`;
    }

    let syroPersona = `ACTÚA COMO SYRÓ... (Modo Síntesis)`;
    if(mode === 'KHA') syroPersona = `ACTÚA COMO SYRÓ EN MODO KHA...`;
    if(mode === 'MOS') syroPersona = `ACTÚA COMO SYRÓ EN MODO MOS...`;
    
    const finalPrompt = `${syroPersona}\n\n"${userPrompt}"`;
    const response = await callGeminiAPI(finalPrompt, false);
    await addNewKnowledge(userPrompt, response, `SYRÓ_Vercel_${mode}`, mode);
    return response;
}

async function findSemanticMatch(newPrompt, mode) {
    await authAndLoadSheets();
    const kbSheet = doc.sheetsByTitle['Knowledge_Base'];
    if (!kbSheet || kbSheet.rowCount < 2) return null;
    const rows = await kbSheet.getRows();
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if ((row.Mode || 'SYNTESIS').toUpperCase() === mode) {
            const storedPrompt = row.Keyword;
            const comparisonPrompt = `Analiza si estas dos frases buscan la misma información. Responde SÍ o NO.\nFRASE 1: "${storedPrompt}"\nFRASE 2: "${newPrompt}"`;
            const similarityResponse = await callGeminiAPI(comparisonPrompt, false);
            if (similarityResponse.toUpperCase().includes("SÍ")) {
                await logSystemEvent('INFO', `Coincidencia semántica encontrada para MODO ${mode}.`, 'findSemanticMatch');
                return { id: row.Entry_ID, keyword: row.Keyword, information: row.Information };
            }
        }
    }
    return null;
}

async function callGeminiAPI(prompt, useSyroPersona = true) {
    // ... (La función callGeminiAPI sin cambios)
}

// --- El resto de funciones auxiliares ---
function parseParameters(paramsString) { /* ... */ }
async function addProject(params) { /* ... */ }
async function createClickUpTask(params) { /* ... */ }
async function logSystemEvent(type, description, source) { /* ... */ }
async function addNewKnowledge(prompt, info, source, mode) { /* ... */ }

// --- Rellenando el resto del código para que sea completo ---
async function callGeminiAPI(prompt, useSyroPersona = true) {if (!GEMINI_API_KEY) throw new Error("API Key de Gemini no configurada.");let finalPromptText = prompt;if (useSyroPersona) {const syroPersona = `ACTÚA COMO SYRÓ...`;finalPromptText = `${syroPersona}\n\n"${prompt}"`;}const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`;const response = await fetch(url, {method: 'POST',headers: { 'Content-Type': 'application/json' },body: JSON.stringify({ "contents": [{"parts": [{"text": finalPromptText}]}] }),});const data = await response.json();if(data.error) { throw new Error(`Error de API de Gemini: ${data.error.message}`); } if(data.candidates && data.candidates.length > 0) {return data.candidates[0].content.parts[0].text.trim();} else {await logSystemEvent('WARN', `Respuesta de Gemini sin contenido. ${JSON.stringify(data)}`, 'callGeminiAPI'); return "Respuesta de API válida pero sin contenido.";}}
function parseParameters(paramsString) {const params = {};const paramPairs = paramsString.split('::');paramPairs.forEach(pair => {const parts = pair.split('=');if (parts.length === 2) {const key = parts[0].trim();let value = parts[1].trim();if (value.startsWith('"') && value.endsWith('"')) {value = value.substring(1, value.length - 1);}params[key] = value;}});return params;}
async function addProject(params) {await authAndLoadSheets();const projectSheet = doc.sheetsByTitle['Project_DB'];const newRow = {Project_ID: `PRJ-${Date.now().toString().slice(-4)}`,Project_Name: params.NAME || 'Sin Nombre',Description: params.DESCRIPTION || '',Status: 'Planning'};const addedRow = await projectSheet.addRow(newRow);await logSystemEvent('INFO', `Nuevo proyecto añadido.`, 'addProject');return addedRow.Project_ID;}
async function createClickUpTask(params) {if (!CLICKUP_TOKEN) throw new Error("API Token de ClickUp no configurado.");const listId = params.LIST_ID || DEFAULT_LIST_ID;if (!listId) throw new Error("ID de Lista de ClickUp no encontrado.");const taskName = params.NAME;if (!taskName) throw new Error("CREATE_CLICKUP_TASK requiere NAME.");const url = `https://api.clickup.com/api/v2/list/${listId}/task`;const response = await fetch(url, {method: 'POST',headers: { 'Authorization': CLICKUP_TOKEN, 'Content-Type': 'application/json' },body: JSON.stringify({ "name": taskName, "markdown_description": params.CONTENT || "" }),});const data = await response.json();if (!response.ok) throw new Error(`Error de API ClickUp: ${JSON.stringify(data)}`);await logSystemEvent('INFO', `Tarea creada en ClickUp con ID: ${data.id}`, 'createClickUpTask');return data.id;}
async function logSystemEvent(type, description, source) {try {await authAndLoadSheets();const logSheet = doc.sheetsByTitle['System_Log'];await logSheet.addRow({ Timestamp: new Date().toISOString(), Event_Type: type, Description: description, Function_Source: source });} catch (e) {console.error("Error al escribir en System_Log:", e.message);}}
async function addNewKnowledge(prompt, info, source, mode) {try {await authAndLoadSheets();const kbSheet = doc.sheetsByTitle['Knowledge_Base'];await kbSheet.addRow({ Entry_ID: `KB-${Date.now().toString().slice(-4)}`, Keyword: prompt, Information: info, Source: source, Confidence_Score: 100, Mode: mode });} catch(e) {console.error("Error al escribir en Knowledge_Base:", e.message);}}
async function executeChain(params) {if (!params.INSTRUCTION) throw new Error("EXECUTE_CHAIN requiere INSTRUCTION.");const chainPrompt = `Eres un planificador para SYRÓ...`;const commandListString = await callGeminiAPI(chainPrompt, false);const commands = commandListString.split('\n').filter(cmd => cmd.trim() !== '' && cmd.includes('::'));await logSystemEvent('INFO', `Cadena generada con ${commands.length} comandos.`, 'executeChain');for (const command of commands) {try {await logSystemEvent('INFO', `Ejecutando de cadena: ${command}`, 'executeChain');const parts = command.split('::');const action = parts[0].trim().toUpperCase();const paramsString = parts.slice(1).join('::');const commandParams = parseParameters(paramsString);await processCommand(action, commandParams);} catch (e) {await logSystemEvent('ERROR', `Error ejecutando comando de cadena '${command}': ${e.message}`, 'executeChain');}}return `Cadena con ${commands.length} comandos ejecutada.`;}