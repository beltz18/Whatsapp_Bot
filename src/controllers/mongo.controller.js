const { MongoClient, ObjectId} = require('mongodb')

class MongoAdapter {
  db
  listHistory = []
  credentials = { dbUri: null, dbName: null }

  constructor(_credentials) {
    this.credentials = _credentials
    this.init().then()
  }

  init = async () => {
    try {
      const client = new MongoClient(this.credentials.dbUri, {})
      await client.connect()
      console.log('Conectado a la DB')
      this.db = client.db(this.credentials.dbName)
      return true
    } catch (e) {
      console.log('Error', e)
      return
    }
  }

  getPrevByNumber = async (from) => {
    const result = await this.db.collection('histories').find({ from }).sort({ _id: -1 }).limit(1).toArray();
    return result[0]
  }

  getSubscriptionActive = async (from, body) => {
    let month = ('0'+(new Date().getMonth() + 1)).slice(-2);
    let year = new Date().getFullYear();
    let date = month+"/"+year;
    
    const thisUser = await this.db.collection('subscriptions').find({ user: from }).toArray()
    const ctxWithDate = {
      user: from,
      message: body,
      response: "Waiting response...",
      tokens: 0,
      conversationId: 0,
      parentMessageId: 0,
      date: new Date(),
      dateFormat: new Date().toLocaleDateString('en-GB')
    }

    if (typeof thisUser[0] != 'undefined') {
      const result = await this.db.collection('subscriptions').find({ user: from, active: true }).toArray()
      //usuario activo
      if (result.length != 0) {
        const plan            = await this.db.collection('plans').find({plan: result[0].plan}).toArray()
        const tokensMensual   = await this.db.collection('subscriber_consumptions').findOne({ user:result[0].user, date: date })
        const TM = tokensMensual != null ? tokensMensual : {consuption: 0};
        const tokensActual    = await this.getUserCoberturaTokens({user: from})
        const TA = tokensActual != null ? tokensActual : [{tokens: 0}];
        const response        = await this.validacionConsumoTokens(plan, TM, TA, ctxWithDate)
        const resp = response == true ? result[0] : {'status': false, 'type': 'plan'};
        return resp
        
      } else { //usario no activo (implica plan free por defecto)
        const qtty = await this.db.collection('histories').countDocuments({ user: from, tokens: { '$gt': 0 } })
        if (parseInt(qtty) > parseInt(process.env.MAXIMUM_MSG)) {
          return { 'status': false, 'type': 'free' }
        } else {
          await this.db.collection('histories').insertOne(ctxWithDate)
          return result[0]
        }
      }
    } else await this.db.collection('subscriptions').insertOne({ user: from, active: false, plan: "free" })
  }

  getlastQuestion = async (from) => {
    let last = await this.db.collection('histories').find({user: from}).sort({$natural:-1}).limit(1).toArray();
    return last;
  }

  updateResponseFromChatGPT = async (idmsm, message, response, tokens, conversationId, parentMessageId) => {
    let reg = await this.db.collection('histories').updateOne({
      _id: ObjectId(idmsm)
    },{
      $set: {message, response, tokens, conversationId, parentMessageId },
    })

    return reg;
  }

  updateResponseDalle = async (idmsm, message, response) => {
    let reg = await this.db.collection('histories').updateOne({
      _id: ObjectId(idmsm)
    },{
      $set: {message, response, tipo: "imagen" },
    })

    return reg;
  }

  updateFailedDalle = async (idmsm, message, response) => {
    let reg = await this.db.collection('histories').updateOne({
      _id: ObjectId(idmsm)
    },{
      $set: {message, response},
    })

    return reg;
  }

  //validar para contabilizar la cantidad de imagen en la mensualidad de suscripción
  countImages = async (user) => {
    try {
      // Obtener las fechas de suscripción activa del usuario
      const subscription = await this.db.collection('subscriptions').findOne({ user: user, active: true});
      console.log("suscripción: ", subscription);
      if(subscription.plan == "testing"){
        return true
      }
      if(subscription.plan == "pro"){
        console.log("inicio DB: ", subscription.active_date);
        console.log("fin: DB", subscription.suspension_date);

        const activeDate = this.convertirFecha(subscription.active_date);
        const suspensionDate = this.convertirFecha(subscription.suspension_date);

        console.log("inicio: ", activeDate);
        console.log("fin: ", suspensionDate);
    
        // Contar los mensajes de tipo 'imagen' en el rango de suscripción
        const count = await this.db.collection('histories').countDocuments({
          user: user,
          tipo: "imagen",
          date: {
            $gte: activeDate,
            $lt: suspensionDate
          }
        });

        console.log("count", count);

        if(count < 60){
          return true
        }else{
          return false;
        }
        
      }
      if(subscription.plan == "basic"){
        return "BASIC"
      }
    } catch (e) {
      console.error("Error al consultar la base de datos: ", e);
      return "ERROR";
    }
  }

  convertirFecha = function (fechaStr) {
    const partes = fechaStr.split("/");
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1; 
    const año = parseInt(partes[2], 10);
  
    return new Date(año, mes, dia);
  }

  getUserCoberturaTokens = async (user='', date='') => {
    const today = date != '' ? date : new Date().toLocaleDateString('en-GB');
    const data  = await new Promise( async (resolve, reject) => {
        const query = user != '' ? {user:user.user, dateFormat: today} : {dateFormat: today};
        const res = await this.db.collection('histories').find(query).toArray();
        if(res.length == 0) {
          return resolve([{user:user.user, tokens: 0}])
        } else {
          const resultado = res.reduce((arr, obj) => {
            const existente = arr.find(item => item.user == obj.user);
            if (existente) {
              existente.tokens = existente.tokens + obj.tokens;
            } else { 
              arr.push({user: obj.user, tokens: obj.tokens});
            }
            return arr;
          }, []);  
          
          return resolve(resultado)
        }
    })

    return data;
  }

  validacionConsumoTokens = async (plan, tokensMensual, tokensActual, ctxWithDate) => {
    let respuesta = false;
    if(plan[0].cobertura  > tokensMensual.consuption) { //validacion cobertura mensual
      if(plan[0].cobertura > (tokensMensual.consuption + tokensActual[0].tokens)) { //validacion en tiempo real de cobertura mensual mas gasto diario
        if(plan[0].cobertura_diaria > tokensActual[0].tokens) { //validacion de cobertura diaria
          await this.db.collection('histories').insertOne(ctxWithDate)
          respuesta = true;
        } 
      } 
    }

    return respuesta
  }

  save = async (ctx) => { this.listHistory.push(ctx) }

  getSuscriptor = async (from) => {
    const thisUser = await this.db.collection('subscriptions').find({ user: from }).toArray()
    return thisUser;
  }

  /*Consulta el Usuario master del bot*/
  getMasterUser = async (phone_number) => {
    const botClient = await this.db.collection('bot_clients').findOne({bot_client_master : phone_number})
    return botClient
  }

  /* apaga o enciende bot por clientes, usando black list */
  updateBlackList = async (phone_number, black_list) => {
    await this.db.collection('bot_clients').updateOne({
      bot_client_master: phone_number
    },{
      $set: { black_list }
    })
  }

  //consultar el ID del ultimo mensaje del usuario
  getidmessage = async (from) => {
    try{
      let last = await this.db.collection('histories').find({user: from}).sort({$natural:-1}).limit(1).toArray();
      const ids = last.map(item => item._id);
      //console.log(ids);
      const idString = ids[0].toString();
      return idString;
    }catch(e){
      console.log("Error al obtener ID del ultimo mensaje: ", e)
    }
  }
}

module.exports = MongoAdapter