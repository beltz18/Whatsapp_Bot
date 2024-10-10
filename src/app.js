require('dotenv').config()
const { setInstanceClass } = require('../ChatGPT/utils.js')

const QRPortalWeb     = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
 
const MongoAdapter    = require('../src/controllers/mongo.controller.js')
const ChatGPT         = require('../ChatGPT/chatgpt.class.js')

const MONGO_DB_URI    = process.env.MONGO_DB_URI
const MONGO_DB_NAME   = process.env.MONGO_DB_NAME

const cron = require('node-cron');
const {vaciarCarpeta} = require('./cron.js');

const {
  createFlow,
  createBot,
  addKeyword,
  addAnswer,
  createProvider,
  EVENTS,
} = require('@bot-whatsapp/bot')

const createBotWithChatGPT = async ({ provider, database }) => {
  return new ChatGPT(database, provider)
}

//flows
/*const flows = {
    'supportFlowa' : addKeyword('Ayuda').addAnswer(`Contactando con SEO Soporte https://wa.me/${process.env.SUPPORT}`),
    'supportFlowb' : addKeyword('ayuda').addAnswer(`Contactando con SEO Soporte https://wa.me/${process.env.SUPPORT}`)
}*/

//adaptadores
const adaptadores = {
  'adapterProvider' : createProvider(BaileysProvider),
  'adapterFlow' : createFlow([])
};

const __main__ = async () => {
  const adapterDB = new MongoAdapter({
    dbUri: MONGO_DB_URI,
    dbName: MONGO_DB_NAME,
  })

  //cron audios
  cron.schedule('59 3 * * 1', async () => {
    console.log("ENTRAMOS AL CRON")
    try{
      await vaciarCarpeta('tmp');
    }catch(e){
      console.log("Error al eliminar audios", e)
    }
  });

  createBot({
    flow: adaptadores.adapterFlow,
    provider: adaptadores.adapterProvider,
    database: adapterDB
  })

  /*createBotWithChatGPT({
    provider: adaptadores.adapterProvider,
    database: adapterDB,
  })*/

  await setInstanceClass(await createBotWithChatGPT({
    provider: adaptadores.adapterProvider,
    database: adapterDB,
  }))
  
  QRPortalWeb()
}

__main__()