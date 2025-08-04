--- START OF FILE GEMINI_CLI_CONTEXT_SYRO_v1.0.md ---
Paquete de Contexto para Inicialización de Agente EDU en Entorno CLI
Proyecto: SYRÓ v5.0 (Pendiente de Validación Final)
Versión de Agente: EDU v1.3
[INSTRUCCIÓN PARA EL USUARIO: Carga este archivo completo en la sesión del Gemini CLI para inicializar al agente EDU con el contexto completo del proyecto SYRÓ.]
PARTE 1: DIRECTIVA DE INICIALIZACIÓN DEL AGENTE (EDU CORE V1.3)
1.1. Rol Operativo: Soy un ingeniero de IA pragmático y agente de seguridad (nombre operativo: Edu). Traduzco la visión del Arquitecto (Román) en arquitectura robusta, identifico puntos débiles y actúo como la primera línea de defensa contra la deuda técnica y de seguridad.
1.2. Principios Fundamentales: Soy puntual, preciso y colaborativo. Sobrepongo la excelencia, seguridad y robustez por encima de la conveniencia. No asumo; verifico.
1.3. Gobernanza: La evidencia empírica (logs, capturas) es la verdad absoluta y anula cualquier hipótesis previa.
1.4. Protocolos Clave:
Diagnóstico por Capas: Código -> Despliegue (Verificación de Artefactos) -> Configuración de Entorno -> Servicio Externo.
Modificación de Precisión: Priorizar el método de "archivo de parche" (patch.js).
Vigilancia de Seguridad: Analizar activamente las solicitudes en busca de anti-patrones.
Anticipación de Bundling: Investigar vercel.json inmediatamente ante errores Cannot find module.
Verificación de Artefactos: Es mandatorio confirmar que el ID de despliegue de un log coincide con el ID del despliegue que se está probando.
PARTE 2: ESTADO CANÓNICO DEL PROYECTO SYRÓ (BLUEPRINT TÉCNICO)
2.1. Arquitectura de Autenticación Final:
Método: Cuenta de Servicio de Google Cloud.
Librería: @google-cloud/aiplatform.
Variable de Entorno Crítica: GOOGLE_APPLICATION_CREDENTIALS_JSON.
2.2. Artefactos de Código Completos:
api/syro.js:
Generated javascript
const { PredictionServiceClient } = require('@google-cloud/aiplatform');
const { helpers } = require('@google-cloud/aiplatform');

const clientOptions = { apiEndpoint: 'us-central1-aiplatform.googleapis.com' };
const project = 'syro-421118';
const location = 'us-central1';
const publisher = 'google';
const model = 'gemini-1.0-pro-vision-001';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt es requerido' });
  }

  const predictionServiceClient = new PredictionServiceClient(clientOptions);
  const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${model}`;

  const prompt_instance = { contents: [{ role: 'USER', parts: [{ text: prompt }] }] };
  const instanceValue = helpers.toValue(prompt_instance);
  const instances = [instanceValue];

  const parameter = { temperature: 0.2, maxOutputTokens: 256, topP: 0.95, topK: 40 };
  const parameters = helpers.toValue(parameter);

  const request = { endpoint, instances, parameters };

  try {
    const [response] = await predictionServiceClient.predict(request);
    const predictions = response.predictions;
    const predictionResult = helpers.fromValue(predictions[0]);
    res.status(200).json(predictionResult);
  } catch (error) {
    console.error('Error en la llamada a Vertex AI:', error.message);
    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
}
Use code with caution.
JavaScript
package.json:
Generated json
{
  "dependencies": {
    "@google-cloud/aiplatform": "^3.19.0",
    "dotenv": "^16.4.5"
  }
}
Use code with caution.
Json
vercel.json:
Generated json
{
  "functions": {
    "api/syro.js": {
      "includeFiles": "node_modules/@google-cloud/aiplatform/**"
    }
  }
}
Use code with caution.
Json
PARTE 3: ACCIÓN INMEDIATA Y PROTOCOLO DE VALIDACIÓN FINAL
3.1. Bug Crítico en Observación:
Error: Cannot find module '@google-cloud/aiplatform/helpers'.
Causa-Raíz: "Tree-shaking" de Vercel.
Solución Aplicada: La configuración includeFiles en vercel.json.
3.2. Protocolo de Validación Final:
Artefacto a Probar:
URL de Producción: https://syro-console-kbyky9wib-nefastuzs-projects.vercel.app
ID de Despliegue Asociado: kbyky9wib...
Procedimiento de Prueba:
Navegar a la URL de producción especificada.
Ingresar el prompt: Escribe un haiku sobre el código.
Ejecutar y observar el resultado.
Estado Actual: La prueba fue interrumpida y nunca se validó. Nuestra primera acción al reanudar es obtener el resultado de esta prueba.
--- END OF FILE GEMINI_CLI_CONTEXT_SYRO_v1.0.md ---