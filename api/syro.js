export const config = {
  api: {
    bodyParser: true,
  },
};
const { GoogleAuth } = require('google-auth-library');

// --- INICIO DE LA FUNCIÓN SERVERLESS ---
export default async function handler(req, res) {
  
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt es requerido' });
  }

  try {
    // --- NUEVA AUTENTICACIÓN FEDERADA ---
    // La librería detectará automáticamente las credenciales del entorno
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    // --- FIN DE LA NUEVA AUTENTICACIÓN ---
    
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const project = 'syro-fresh-start';
    const location = 'us-central1';
    const model = 'gemini-1.0-pro';

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

    const body = {
      instances: [{
        content: {
          parts: [{ text: prompt }]
        }
      }],
      parameters: {
        temperature: 0.2,
        maxOutputTokens: 256,
        topK: 40,
        topP: 0.95
      }
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
    
    const fullText = data.predictions[0].content.parts[0].text;

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
    console.error('Error en el handler de la API:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor al procesar la solicitud.',
      error: error.message 
    });
  }
}