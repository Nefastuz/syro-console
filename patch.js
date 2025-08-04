const fs = require('fs');
const path = require('path');

// --- 1. MODIFICAR package.json ---
console.log('Modificando package.json...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Eliminar la dependencia problemática
delete packageJson.dependencies['@google-cloud/aiplatform'];
// Añadir la librería de autenticación ligera
packageJson.dependencies['google-auth-library'] = '^9.0.0'; // Usar una versión estable

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
console.log('Éxito: package.json actualizado. Se eliminó @google-cloud/aiplatform, se añadió google-auth-library.');

// --- 2. REEMPLAZAR api/syro.js ---
console.log('Reemplazando api/syro.js con la nueva arquitectura...');
const apiFilePath = path.join(process.cwd(), 'api', 'syro.js');
const newApiContent = `
const { GoogleAuth } = require('google-auth-library');

// --- INICIO DE LA FUNCIÓN SERVERLESS ---
export default async function handler(req, res) {
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
    const project = 'syro-421118';
    const location = 'us-central1';
    const model = 'gemini-1.0-pro'; // El modelo para este endpoint es más simple

    const url = \`https://\${location}-aiplatform.googleapis.com/v1/projects/\${project}/locations/\${location}/publishers/google/models/\${model}:streamGenerateContent\`;

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
        'Authorization': \`Bearer \${accessToken}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(\`API request failed with status \${response.status}: \${errorBody}\`);
    }

    const data = await response.json();

    // Extraer y combinar el texto de la respuesta
    const fullText = data.map(chunk => chunk.candidates[0].content.parts[0].text).join('');

    res.status(200).json({ text: fullText });

  } catch (error) {
    console.error('Error en el handler de la API:', error.message);
    res.status(500).json({ 
      message: 'Error interno del servidor al procesar la solicitud.',
      error: error.message 
    });
  }
}
// --- FIN DE LA FUNCIÓN SERVERLESS ---
`;

fs.writeFileSync(apiFilePath, newApiContent.trim(), 'utf8');
console.log('Éxito: api/syro.js ha sido reemplazado con el nuevo flujo de autenticación y fetch.');

// --- 3. (Opcional pero recomendado) Limpiar vercel.json ---
console.log('Limpiando vercel.json...');
const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
if (fs.existsSync(vercelJsonPath)) {
  const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  delete vercelJson.functions; // Eliminar la directiva 'functions' que era ineficaz
  if (Object.keys(vercelJson).length === 0) {
    fs.unlinkSync(vercelJsonPath); // Si el archivo queda vacío, se elimina
    console.log('Éxito: vercel.json ha sido eliminado ya que no es necesario.');
  } else {
    fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelJson, null, 2), 'utf8');
    console.log('Éxito: La configuración ineficaz ha sido eliminada de vercel.json.');
  }
}

console.log('*** PIVOTE ARQUITECTÓNICO COMPLETADO ***');