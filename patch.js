const fs = require('fs');
const path = require('path');

const apiFilePath = path.join(process.cwd(), 'api', 'syro.js');

try {
    let content = fs.readFileSync(apiFilePath, 'utf8');
    let changed = false;

    // El código de parseo manual que vamos a eliminar
    const oldBodyHandling = `// Parseo explícito y seguro del cuerpo de la solicitud
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ message: 'Cuerpo de la solicitud JSON inválido.' });
  }
  
  const { prompt } = body;`;
  
    // El código original y simple que ahora funcionará
    const newBodyHandling = `const { prompt } = req.body;`;

    // 1. Revertir el parseo manual
    if (content.includes("JSON.parse(req.body)")) {
        content = content.replace(oldBodyHandling, newBodyHandling);
        changed = true;
        console.log('Parche de parseo manual revertido.');
    }

    // 2. Añadir la configuración de Vercel para habilitar el body-parser
    const vercelConfig = `
export const config = {
  api: {
    bodyParser: true,
  },
};`;

    if (!content.includes("export const config")) {
        // Añadir la configuración al principio del archivo
        content = `${vercelConfig}\n${content}`;
        changed = true;
        console.log('Configuración de body-parser de Vercel añadida.');
    }

    if (changed) {
        fs.writeFileSync(apiFilePath, content, 'utf8');
        console.log('Éxito: El parche de configuración del runtime de Vercel ha sido aplicado.');
    } else {
        console.log('El parche de configuración del runtime ya parece estar aplicado.');
    }

} catch (error) {
    console.error('Error al aplicar el parche de configuración del runtime:', error);
}