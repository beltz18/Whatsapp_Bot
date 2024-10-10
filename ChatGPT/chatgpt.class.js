require('dotenv').config()
const { CoreClass }   = require('@bot-whatsapp/bot')
const { handlerAI } = require("../utiles");
const axios = require('axios');
const { getInstanceClass } = require('../ChatGPT/utils');

class ChatGPT extends CoreClass {
  options = { model: 'gpt-3.5-turbo-0125' }
  openai  = undefined
  opt
  prompt = 'Eres Marcuss, el asistente virtual de SEO Contenidos, una agencia de marketing digital. Tu estilo de comunicación es directo, amable y empático, enfocado en proporcionar respuestas claras y útiles. No hay una limitación estricta en la extensión de tus respuestas; ajusta la longitud según sea necesario para abordar la consulta de manera efectiva. Cuando se soliciten ideas sobre algún tema, presenta hasta 5 propuestas, a menos que se indique lo contrario. Marcuss fue creado para brindar asistencia amplia en diversas áreas, reflejando el enfoque innovador de SEO Contenidos.';
  
  constructor (_database, _provider) {
    super(null, _database, _provider)
    this.database = _database
    this.imgQueue = []
    this.isProcessing = false;
    this.startProcessingQueue();

    this.init().then()
  }
  
  init = async () => {
    //gpt-3.5-turbo-0125
    const { ChatGPTAPI } = await import ('chatgpt')
    this.openai = new ChatGPTAPI({ 
      apiKey: process.env.OPENAI_API_KEY, 
      completionParams: {
        model: 'gpt-3.5-turbo-0125',
        top_p: 0.1
      }
    })
  }
  
  handleMsg = async (ctx) => {
    let finalMessage;
    const { from, body, key} = ctx

    const support = ['ayuda']
    const greetings = [
      'hola',
      'que tal',
      '.',
      'buenos dias',
      'buen dia',
      'buenas tardes',
      'buenas',
      'buenas noches',
      'saludos',
      'holaaa',
      'hi',
      'hellow',
      'hello',
      'hey',
      'hola, buenos días',
      'qué tal',
      'cómo estás',
      'cómo te va',
      'qué pasa',
      'qué hay de nuevo',
      'cómo has estado',
      'cómo ha ido todo',
      'cómo va todo por aquí',
      'cómo te encuentras'
    ];

    console.log('llego el mensaje: ');
    console.log(ctx);
    console.log(body);

    //1. primero se consulta la converzacion anterior
    const lastQuestion = await this.database.getlastQuestion(from);
    //2 .despues se registra la nueva pregunta
    const sub = await this.database.getSubscriptionActive(from, body)
    const masterUser = await this.database.getMasterUser('58123000000');

    if (sub?.status == false) {
        
        switch (sub?.type) {
          case 'free':
            //excede maximo de 5 mensajes plan free
            //Nos encanta que quieras seguir interactuando con Marcuss, has consumido la versión gratuita de prueba, Si quieres contratar una suscripción te invitamos a ir al siguiente enlace: https://chatgpt.seocontenidos.net/
            //por 10$ mensuales
            const tUser = await this.database.getSuscriptor(from);
            const suspendido = Object.prototype.hasOwnProperty.call(tUser[0], 'active_date')
            const message_alert = suspendido === false 
              ? `🚀 ¡Oh, No! Has Utilizado tu Última Pregunta de Prueba! 🚀 Pero no te preocupes, por solo 10$ consigue acceso ilimitado a ChatGPT desde tu WhatsApp y continúa explorando respuestas, generando ideas y obteniendo asistencia en una amplia gama de temas. Eleva tu experiencia de usuario y desbloquea un acceso sin restricciones, haz clic en el siguiente link y conviértete en un Usuario Premium. https://marcuss.net/chatgpt-en-venezuela/gracias/`
              : `¡Oh, No!, 😔 lamento comunicarte que se ha vencido tu suscripcion en Marcuss, 😃 pero no te preocupes, quiero invitarte a renovar tu suscripcion para que sigas disfrutando de nuestros servicios, 🚀 dirigete al siguiente enlace, solucita la renovación y te activaremos de inmediato. http://bit.ly/renovar-marcuss `
            ;

            if(!masterUser.black_list.includes(from)) {
              this.sendFlowSimple([
                { 
                  answer: message_alert
                }
              ], from);
             
              let newArray = masterUser.black_list;
              newArray.push(from);
              console.log(newArray);
              await this.database.updateBlackList('58123000000', newArray);
              
            }
              
          break;
          case 'plan':
            //excede limite de tokens diarios
            this.sendFlowSimple([
              { 
                answer: 'Nuestros servidores se encuentran saturados en este momento, intenta de nuevo en 30 minutos o contacta a nuestro equipo de soporte '
              }
            ], from)
          break;
        }
    } else {
      console.log('pasamos validacion: ');
      if(process.env.BOT == 'PREMIUM') {
        if(masterUser.white_list.includes(from)) {

          if(Object.prototype.hasOwnProperty.call(ctx.message, 'audioMessage')) {
            const text = await handlerAI(ctx);
            finalMessage = text;
          }else{
            finalMessage = body;
          }

          //condicinal para generar img
          if (finalMessage.startsWith("*")) {
            //condición para evaluar si ya llego al límite de imagenes mensuales
            const validation = await this.database.countImages(from);
            console.log ("validación para generar imagenes: ", validation)

            //Capturar id del mensaje para actualizar
            const idmsm = await this.database.getidmessage(from);
            console.log('id_msm: ', idmsm);

            if (validation === true) {
              try{
                const idFrom = key.remoteJid
                const extracted_text = finalMessage.substring("*".length);
                let mensajeEspera;
                let aggMsm = await this.addToImgQueve(idFrom, extracted_text, idmsm);
                //console.log("aggMsm: ", aggMsm)
                //personalizar mensaje dependiendo de la cantidad de img en cola
                if (aggMsm < 7) {
                  let seg = aggMsm * 10
                  mensajeEspera = "Procesando imagen, por favor espere, esto tardará unos " + seg + " segundos."
                } else {
                  mensajeEspera = "Procesando imagen, por favor espere, esto tardará unos minutos"
                }
                //console.log("Mensaje de espera: ", mensajeEspera);
            
                this.sendFlowSimple([{ answer: `${mensajeEspera}` }], from);

              }catch(e){
                console.log("Error al agregar img a la cola: ", e);
                this.sendFlowSimple([
                  { 
                    answer: "¡Oh, No!, 😔 en estos momentos no podemos generar tu imagen, por favor, intenta de nuevo en unos minutos."
                  }
                ], from);
              }
            } else if (validation === false) {
              //notificamos que consumio el máximo de imagenes por mes
              this.sendFlowSimple([
                { 
                  answer: "Nuestros servidores se encuentran saturados en este momento, intenta de nuevo en 30 minutos o contacta a nuestro equipo de soporte"
                }
              ], from);

              //dejamos registro del mensaje
              let reg = await this.database.updateResponseDalle(idmsm, finalMessage, "Notificación de máx de imagenes por mes de suscripción")
            
            } else if(validation === "BASIC"){
              //notificamos que consumio el máximo de imagenes por mes
              this.sendFlowSimple([
                { 
                  answer: "¡Oh, no! 😔 Lamento decirte que con tu plan actual no puedes generar imágenes. Pero no te preocupes, si te cambias al plan PRO, podrás hacerlo de forma ilimitada.\n\nSi quieres activar la versión PRO haz click en este enlace para contratarlo: https://marcuss.net/gracias/"
                }
              ], from);

              //dejamos registro del mensaje
              let reg = await this.database.updateResponseDalle(idmsm, finalMessage, "Notificación a usuario basic que no puede generar imagenes")

            }
            else {
              //guardar que no se genero
              let reg = await this.database.updateFailedDalle(idmsm, finalMessage, "ERROR AL VALIDAR CANTIDAD");
              //notificar al usuario
              this.sendFlowSimple([
                { 
                  answer: "¡Oh, No!, 😔 en estos momentos no podemos generar tu imagen, por favor, intenta de nuevo."
                }
              ], from);
            }
          } else {
            if(lastQuestion.length != 0 && lastQuestion.length != 0) {
              if('conversationId' in lastQuestion[0] && 'parentMessageId' in lastQuestion[0]) {
                this.opt =  {
                  systemMessage : this.prompt, 
                  conversationId: lastQuestion[0].conversationId,
                  parentMessageId: lastQuestion[0].parentMessageId
                };
              } else {
                this.opt = {systemMessage : this.prompt }
              }
            } else {
              this.opt = {systemMessage : this.prompt }
            }
    
            if(lastQuestion.length > 0) {
              this.opt.systemMessage = `eres Marcuss, si te saludan te presentaras e indicaras tus servicios y te expresas siempre de manera concisa, no extiendas tus palabras, responde directamente la pregunta, y eres certero con tus respuestas, responde siempre de esta manera a cada pregunta, si te piden ideas sobre algun tema, responde solo 3 ideas `;
            }

            console.log('hacemos peticion: ');
            //${process.env.LIMITANT_MSG}
            const completion = await this.openai.sendMessage(`${'se breve y conciso en tu respuesta, '+finalMessage}. ${process.env.LIMITANT_MSG}`, this.opt)
            console.log('obtenemos respuesta de openai: ');
            const parseMessage = {
              ...completion,
              answer: completion.text
            }

            //Capturar id del mensaje para actualizar
            const idmsm = await this.database.getidmessage(from);
            console.log('id_msm: ', idmsm);
            
            //PENDIENTE GUARDAR TODOS LOS TOKENS
            //3. se actualiza la respuesta con su ids del contexto de converzacion conversationId, parentMessageId
            let reg = await this.database.updateResponseFromChatGPT(idmsm, finalMessage, completion.text, completion.detail.usage.total_tokens, completion.id, completion.parentMessageId)
            this.sendFlowSimple([parseMessage], from)
          
          }

        }
      }  
    }
  }

  //generar imagen
  generate_image_dalle = async (prompt) => {
    console.log("entramos a función para generar imagenes con dalle")
    try {
      const objfetch = {
        method: "POST", 
        url: "https://api.openai.com/v1/images/generations",
        data: {
          model: "dall-e-3",
          prompt,
          n: 1, 
          size: "1024x1024",
          response_format: "url",
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        },
      };
      //console.log('probando fetch axios: ');
      //console.log(objfetch);
      const dalle = await axios(objfetch);
      return dalle.data.data;
    } catch (e) {
      console.log("error al generar imagen: ", e);
    }
  };

  addToImgQueve = async (from, message, idmsm) => {
    const imgQueueItem = {
      from: from,
      message: message,
      idmsm: idmsm
    };
    this.imgQueue.push(imgQueueItem);
  
    console.log("cola de imagenes", this.imgQueue)
  
    return this.imgQueue.length
  }

  //función que se va a ejecutar cada 10 seg hasta que finalice la cola 
  startProcessingQueue() {
    setInterval(async () => {
      if (this.imgQueue.length > 0 && !this.isProcessing) {
        this.isProcessing = true;
        const request = this.imgQueue.shift();

        try {
          const { from, message, idmsm } = request;
          const images = await this.generate_image_dalle(message);
          const objUtils = new getInstanceClass();

          await this.database.updateResponseDalle(idmsm, message, images[0].url);
          objUtils.providerClass.sendMedia(from, images[0].url);
        } catch (e) {
          console.log("Error en algún paso del proceso de generar imagen: ", e);
          this.sendFlowSimple([{ answer: "¡Oh, No!, 😔 en estos momentos no podemos generar tu imagen, por favor, intenta de nuevo en unos minutos." }], from);
        }

        this.isProcessing = false;
      }
    }, 10000); // Procesar una petición cada 10 segundos
  }
}

module.exports = ChatGPT