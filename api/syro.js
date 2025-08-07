import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: true,
  },
};

// --- INICIO DE LA FUNCIÓN SERVERLESS v5.6 ---
export default async function handler(req, res) {
  
  // CORS Preflight & Headers
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

  // --- INICIO DE LA MODIFICACIÓN DE DEBUG ---
  // Vamos a inspeccionar el cuerpo de la petición que llega al servidor.
  console.log('Cuerpo de la petición recibido:', req.body);
  // --- FIN DE LA MODIFICACIÓN DE DEBUG ---

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt es requerido' });
  }

  try {
    // ... el resto del código permanece igual ...
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE,
    });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-oss-20b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const fullText = completion.choices[0].message.content;

    const finalResponse = {
        candidates: [{
          content: {
            parts: [{ text: fullText }]
          }
        }]
    };

    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Error en el handler de la API (v5.6):', error);
    res.status(500).json({ 
      message: 'Error interno del servidor al procesar la solicitud con el AI Gateway.',
      error: error.message 
    });
  }
}