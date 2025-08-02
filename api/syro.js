// Usamos 'require' para máxima compatibilidad con el entorno de Vercel
const { GoogleSpreadsheet } = require('google-spreadsheet');

// --- CONFIGURACIÓN DE CREDENCIALES ---
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const DEFAULT_LIST_ID = process.env.DEFAULT_LIST_ID;

// --- INICIALIZACIÓN DE GOOGLE SHEETS ---
const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
const authSheets = async () => {
    await doc.useServiceAccountAuth({
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    });
    await doc.loadInfo(); // Cargar la información de la hoja una vez autenticado
};

// --- HANDLER PRINCIPAL DE LA API CON CORS ---
module.exports = async (req, res) => {
    // Establecer cabeceras CORS para permitir la conexión desde cualquier origen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const command = req.query.cmd;
        if (!command) throw new Error('Parámetro "cmd" no encontrado.');
        
        const parts = command.split('::');
        if (parts.length < 2) throw new Error("Formato de comando inválido.");
        
        const action = parts[0].trim().toUpperCase();
        const paramsString = parts.slice(1).join('::');
        const params = parseParameters(paramsString);
        
        const result = await processCommand(action, params);
        
        res.status(200).json(result);
    } catch (error) {
        await logSystemEvent('ERROR', `Error en handler: ${error.message}`, 'handler');
        res.status(500).json({ status: 'error', message: error.message });
    }
};


// --- LÓGICA CENTRAL Y EL RESTO DEL CÓDIGO ---
// (El resto de la lógica interna no necesita cambios)
async function processCommand(action, params) {try {await logSystemEvent('INFO', `Acción: ${action}`, 'processCommand');switch (action) {case 'ADD_PROJECT': return { status: 'success', message: 'Proyecto añadido.', data: await addProject(params) };case 'CREATE_CLICKUP_TASK': return { status: 'success', message: 'Tarea creada en ClickUp.', data: await createClickUpTask(params) };case 'ASK_SYRO': const syroResponse = await askSyro(params); return { status: 'success', message: 'Pregunta procesada.', data: syroResponse };case 'EXECUTE_CHAIN': return { status: 'success', message: 'Cadena de comandos ejecutada.', data: await executeChain(params) };default: throw new Error(`Acción desconocida: ${action}`);}} catch (error) {await logSystemEvent('ERROR', `Error en processCommand: ${error.message}`, 'processCommand');throw error;}}
async function askSyro(params) {if (!params.PROMPT) throw new Error("ASK_SYRO requiere un parámetro PROMPT.");const userPrompt = params.PROMPT;const mode = (params.MODE || 'SYNTESIS').toUpperCase();const memoryResult = await findSemanticMatch(userPrompt, mode);if (memoryResult) {await logSystemEvent('INFO', `Respuesta SEMÁNTICA encontrada en VORO para MODO ${mode}. ID: ${memoryResult.id}`, 'askSyro_VORO');return `[Respuesta recuperada de mi memoria VORO (Modo ${mode}) para la pregunta original: "${memoryResult.keyword}"]:\n\n${memoryResult.information}`;}let syroPersona = '';switch (mode) {case 'KHA':syroPersona = `ACTÚA COMO SYRÓ EN MODO KHA...`;break;case 'MOS':syroPersona = `ACTÚA COMO SYRÓ EN MODO MOS...`;break;default:syroPersona = `ACTÚA COMO SYRÓ EN MODO SÍNTESIS...`;}const finalPrompt = `${syroPersona}\n\n"${userPrompt}"`;await logSystemEvent('INFO', `Consultando a Gemini en MODO: ${mode}.`, 'askSyro');const response = await callGeminiAPI(finalPrompt, false);await logSystemEvent('INFO', `Nuevo conocimiento (MODO ${mode}) guardado en VORO.`, 'askSyro');await addNewKnowledge(userPrompt, response, `SYRÓ_Cognitive_v6_${mode}`, mode);return response;}
async function findSemanticMatch(newPrompt, mode) {const kbSheet = doc.sheetsByTitle['Knowledge_Base'];if (kbSheet.rowCount < 1) return null;const rows = await kbSheet.getRows();for (let i = rows.length - 1; i >= 0; i--) {const row = rows[i];const storedMode = (row.Mode || 'SYNTESIS').toUpperCase();if (storedMode === mode) {const storedPrompt = row.Keyword;const comparisonPrompt = `Analiza si estas dos frases buscan la misma información. Responde SÍ o NO.\nFRASE 1: "${storedPrompt}"\nFRASE 2: "${newPrompt}"`;const similarityResponse = await callGeminiAPI(comparisonPrompt, false);if (similarityResponse.toUpperCase().includes("SÍ")) {return { id: row.Entry_ID, keyword: row.Keyword, information: row.Information };}}}return null;}
async function executeChain(params) {if (!params.INSTRUCTION) throw new Error("EXECUTE_CHAIN requiere INSTRUCTION.");const chainPrompt = `Eres un planificador para SYRÓ...`;const commandListString = await callGeminiAPI(chainPrompt, false);const commands = commandListString.split('\n').filter(cmd => cmd.trim() !== '' && cmd.includes('::'));await logSystemEvent('INFO', `Cadena generada con ${commands.length} comandos.`, 'executeChain');for (const command of commands) {try {await logSystemEvent('INFO', `Ejecutando de cadena: ${command}`, 'executeChain');const parts = command.split('::');const action = parts[0].trim().toUpperCase();const paramsString = parts.slice(1).join('::');const commandParams = parseParameters(paramsString);await processCommand(action, commandParams);} catch (e) {await logSystemEvent('ERROR', `Error ejecutando comando de cadena '${command}': ${e.message}`, 'executeChain');}}return `Cadena con ${commands.length} comandos ejecutada.`;}
async function createClickUpTask(params) {if (!CLICKUP_TOKEN) throw new Error("API Token de ClickUp no configurado.");const listId = params.LIST_ID || DEFAULT_LIST_ID;if (!listId) throw new Error("ID de Lista de ClickUp no encontrado.");const taskName = params.NAME;if (!taskName) throw new Error("CREATE_CLICKUP_TASK requiere NAME.");const url = `https://api.clickup.com/api/v2/list/${listId}/task`;const response = await fetch(url, {method: 'POST',headers: { 'Authorization': CLICKUP_TOKEN, 'Content-Type': 'application/json' },body: JSON.stringify({ "name": taskName, "markdown_description": params.CONTENT || "" }),});const data = await response.json();if (!response.ok) throw new Error(`Error de API ClickUp: ${JSON.stringify(data)}`);await logSystemEvent('INFO', `Tarea creada en ClickUp con ID: ${data.id}`, 'createClickUpTask');return data.id;}
async function callGeminiAPI(prompt, useSyroPersona = true) {if (!GEMINI_API_KEY) throw new Error("API Key de Gemini no configurada.");let finalPromptText = prompt;if (useSyroPersona) {const syroPersona = `ACTÚA COMO SYRÓ...`;finalPromptText = `${syroPersona}\n\n"${prompt}"`;}const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`;const response = await fetch(url, {method: 'POST',headers: { 'Content-Type': 'application/json' },body: JSON.stringify({ "contents": [{"parts": [{"text": finalPromptText}]}] }),});const data = await response.json();if(data.candidates && data.candidates.length > 0) {return data.candidates[0].content.parts[0].text.trim();} else {await logSystemEvent('WARN', `Respuesta de Gemini sin contenido. ${JSON.stringify(data)}`, 'callGeminiAPI'); return "Respuesta de API válida pero sin contenido.";}}
function parseParameters(paramsString) {const params = {};const paramPairs = paramsString.split('::');paramPairs.forEach(pair => {const parts = pair.split('=');if (parts.length === 2) {const key = parts[0].trim();let value = parts[1].trim();if (value.startsWith('"') && value.endsWith('"')) {value = value.substring(1, value.length - 1);}params[key] = value;}});return params;}
async function addProject(params) {await authSheets();const projectSheet = doc.sheetsByTitle['Project_DB'];const newRow = {Project_ID: `PRJ-${Date.now().toString().slice(-4)}`,Project_Name: params.NAME || 'Sin Nombre',Description: params.DESCRIPTION || '',Status: 'Planning'};const addedRow = await projectSheet.addRow(newRow);await logSystemEvent('INFO', `Nuevo proyecto añadido.`, 'addProject');return addedRow.Project_ID;}
async function logSystemEvent(type, description, source) {try {await authSheets();const logSheet = doc.sheetsByTitle['System_Log'];await logSheet.addRow({ Timestamp: new Date().toISOString(), Event_Type: type, Description: description, Function_Source: source });} catch (e) {console.error("Error al escribir en System_Log:", e.message);}}
async function addNewKnowledge(prompt, info, source, mode) {try {await authSheets();const kbSheet = doc.sheetsByTitle['Knowledge_Base'];await kbSheet.addRow({ Entry_ID: `KB-${Date.now().toString().slice(-4)}`, Keyword: prompt, Information: info, Source: source, Confidence_Score: 100, Mode: mode });} catch(e) {console.error("Error al escribir en Knowledge_Base:", e.message);}}