/*

  * LIBRERIA JS DE NOTIFICACION ZAPIER PRODUCTOS BAILEYS v1.0 Seo Contenidos C.A
----------------------------------------------------
  * CONSTRUCCION
  1) CREAR LA CARPETA utils EN LA RAIZ DEL PROYECTO
  2) CREAR DENTRO DE LA CARPETA utils EL ARCHIVO utils.js
  3) DENTRO DEL ARCHIVO utils.js COPIAR Y PEGAR TODO EL CODIGO DE ESTE DOCUMENTO
  
  * IMPLEMENTACIÓN
  1) DIRIGIRSE A LA SIGUIENTE DIRECCION DEL PROYECTO node_modules/@bot_whatsapp/provider/baileys/index.cjs
  2) DENTRO DEL ARCHIVO index.cjs copiar y pegar esta linea de codigo: const { NotificationBot_ZAPIER } = require('../../../../../utils/utils'); en la cabecera del junto a los demas requires
  3) EN EL MISMO ARCHIVO index.cjs copiar y pegar esta linea de codigo: await NotificationBot_ZAPIER(state.creds); en la linea 311 del archivo, como referencia esta linea esta dentro la de funcion initBailey despues de un setInterval

  * CONSIDERACIONES
  1) ASEGURARCE DE TENER INSTALADO EL MODULO dontenv en el proyecto, la URL que dispara el trigger en la funcion activarTrigger en el fectch viene por variable de entorno TRIGGER_ZAPIER_URL Y TRIGGER_ZAPIER_BOT_NAME es el nombre del bot en cuestion, asegurarce que esta variables se configuren como variables de entorno del servidor
      * TRIGGER_ZAPIER_BOT_NAME = BOT_ASSISTENTE (el nombre que considere).
      * TRIGGER_ZAPIER_URL = https://apinotificationbots-production.up.railway.app (ESTA ES LA BASE URL OFICIAL PARA DISPARAR EL TRIGGER) el endpoint esta seteado en la funcion es: /activarTrigger
 
  2) EL TOKEN DE Autorization en el header del fetch de la funcion activarTrigger debe ser igual al que esta en la base de datos de mongodb api_notification_bots_zapier en su colección api_users en acces_token (POR DEFECTO YA ESTA CONFIGURADO CORRECTAMENTE).

*/ 

require('dotenv').config();

let stateBot = false;
let stateSendNotification = false;
async function verificationState(stateBot) {
  if(stateBot == false && stateSendNotification == false) {
    console.log('generando nueva notificacion');
    console.log('ejeutando fetch');
    const objData = {
      bot_name: process.env.TRIGGER_ZAPIER_BOT_NAME,
      status: 'DESVINCULADO',
      message: 'EL BOT SE DESVINCULÓ',
    };
    const resultFetch = await activarTrigger(objData);
    stateSendNotification = true;

    return resultFetch
  } else {
    console.log('status de bot y notificacion');
    console.log('bot: '+stateBot);
    console.log('stateSendNotification: '+stateSendNotification);
    return false;
  }
}

async function getStateBot(state) {
  stateBot = state;
  if(stateBot == true) {
    stateSendNotification = false;
  }
  return await verificationState(stateBot);
}

//services function
async function NotificationBot_ZAPIER(state) {
  if ('pairingCode' in state) {
    console.log('EL BOT ESTA DESVINCULADO');
    const r1 = await getStateBot(false);
    console.log('este es el resultado final: '+r1);
  } else {
    console.log("El BOT ESTA VINCULADO");
    const r2 = await getStateBot(true);
  }
}

//fetch
async function activarTrigger(objData) {
  try {
    const response = await fetch(process.env.TRIGGER_ZAPIER_URL+'/activarTrigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbmF4YWdvcmFzZGVjbGFzb21lbmFzIiwibmFtZSI6InNlb19jb250ZW5pZG9zIiwiaWF0IjoxMjg4MDkzMzY2fQ.6rdzNjNfB5oHyzoIMR0DXvepwgw9tQxnxtIXUXhkmJM'
      },
      body: JSON.stringify(objData)
    });
    const data = await response.json();
    console.log('Resultado de la petición:', data);
    return true;
  } catch (error) {
    console.error('Error:', error);
  }
}
module.exports = { NotificationBot_ZAPIER }
