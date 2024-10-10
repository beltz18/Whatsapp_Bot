require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

//vaciar carpeta tmp "audios"
async function vaciarCarpeta(dir) {
    try {
        // Lee los archivos y carpetas dentro del directorio
        const archivos = await fs.readdir(dir);
        for (const archivo of archivos) {
            // Crea el path completo del archivo
            const rutaCompleta = path.join(dir, archivo);
            // Obtiene información del archivo para determinar si es un archivo o una carpeta
            const estadisticas = await fs.stat(rutaCompleta);
            if (estadisticas.isDirectory()) {
                console.log("Es una carpeta."); //Es una carpeta
            } else {
                // Si es un archivo, se elimina
                await fs.unlink(rutaCompleta);
                console.log(`Archivo eliminado: ${rutaCompleta}`);
            }
        }
        console.log('Todos los archivos han sido eliminados.');
    } catch (error) {
        console.error('Error al intentar vaciar la carpeta:', error);
    }
}

module.exports = {
    vaciarCarpeta,
  }