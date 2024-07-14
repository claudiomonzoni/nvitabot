import { join } from 'path'

import "dotenv/config";

import {
    createBot,
    createProvider,
    createFlow,
    addKeyword,
    EVENTS,
} from "@builderbot/bot";
import { JsonFileDB as Database } from '@builderbot/database-json'
// import { MemoryDB as Database } from "@builderbot/bot";
import {
  BaileysProvider,
  BaileysProvider as Provider,
} from "@builderbot/provider-baileys";
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants";
import { typing } from "./utils/presence";
import { numberClean } from "./utils/utils";

const PORT = process.env?.PORT ?? 3008;
const ASSISTANT_ID = process.env?.ASSISTANT_ID ?? "";
const ADMIN_NUMBER = process.env?.ADMIN_NUMBER ?? "";


const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state, provider, blacklist, gotoFlow }) => {
    // reviso si esta muteado
    const dataCheck = blacklist.checkIf(ctx.from);
    if (state.get<boolean>("botOffForThisUser")) {
      // if (dataCheck && ctx.body === "dudas") {
      console.log(`muteado listo para activar el chatbot de nuevo`);
      blacklist.remove(ctx.from);
      await flowDynamic("Aida estará atendiendo tus dudas de Nvite");
    } else {
      await typing(ctx, provider);
      const response = await toAsk(ASSISTANT_ID, ctx.body, state);
      const chunks = response.split(/\n\n+/);
      for (const chunk of chunks) {
        await flowDynamic([{ body: chunk.trim() }]);
      }
    }
  }
);

// switch para detener la conversación con el numero. solo debo escribir Mute -34000000 (en numero del usuario)
// const mutear = addKeyword<Provider, Database>("comprar").addAction(
//   async (ctx, { blacklist, flowDynamic }) => {
//     // ctx.from= 5217551048550
//     // console.log(ctx.body);
//     // if (ctx.from === ADMIN_NUMBER) {
//     // console.log(ctx.from);
//     // const toMute = numberClean(ctx.body); //Mute +34000000 message incoming
//     const toMute = ctx.from;
//     const check = blacklist.checkIf(ctx.from);
//     if (!check) {
//       blacklist.add(toMute);
//       await flowDynamic(
//         "Espero haber contestado todos tus dudas, por favor espera a que un agente de ventas continue con esta conversación"
//       );
//       return;
//     }
//     // }
//   }
// );

const flow = addKeyword<BaileysProvider>(["deseo hablar con ventas", "quiero hablar con una persona", "deseo hablar con una persona", "quiero que me atienda una persona"])
  .addAction(async (_, { state, endFlow }) => {
    const botOffForThisUser = state.get<boolean>("botOffForThisUser");
    await state.update({ botOffForThisUser: !botOffForThisUser });
    if (botOffForThisUser) return endFlow();
  })
  .addAnswer("Espero haber contestado todos tus dudas, por favor espera a que un agente de ventas continue con esta conversación");

const desmutear = addKeyword<Provider, Database>("dudas").addAction(
  async (ctx, { blacklist, flowDynamic }) => {
    const numero = ctx.from;
    const check = blacklist.checkIf(numero);
    if (check) {
      blacklist.remove(numero);
      await flowDynamic("Aida estará atendiendo tus dudas de Nvite");
      return;
    }

    // }
  }
);

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, flow]);
  // const adapterFlow = createFlow([welcomeFlow, blackListFlow]);
  const adapterProvider = createProvider(Provider);
  const adapterDB = new Database();

  const { httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  httpInject(adapterProvider.server);
  httpServer(+PORT);
};

main();

