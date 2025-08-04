export const config = {
  api: {
    bodyParser: true,
  },
};
const { GoogleAuth } = require('google-auth-library');

// --- INICIO DE LA FUNCIÓN SERVERLESS ---
export default async function handler(req, res) {
  
  // Manejar la solicitud preflight de CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }
  
  // Permitir CORS para la solicitud POST real
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt es requerido' });
  }

  try {
    // --- FASE 1: OBTENER TOKEN DE AUTENTICACIÓN ---
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    // --- FASE 2: REALIZAR LLAMADA FETCH AUTENTICADA ---
    const project = 'syro-467919';
    const location = 'us-central1';
    const model = 'gemini-2.0-flash-001'; // <-- EL MODELO CORRECTO

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:streamGenerateContent`;

    const body = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    const fullText = data.map(chunk => chunk.candidates[0].content.parts[0].text).join('');

    const finalResponse = {
        candidates: [{
          content: {
            parts: [{
              text: fullText
            }]
          }
        }]
    };
    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Error en el handler de la API:', error.message);
    res.status(500).json({ 
      message: 'Error interno del servidor al procesar la solicitud.',
      error: error.message 
    });
  }
}