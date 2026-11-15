import type { Labels, Stage } from './config'

export type Speaker = 'player' | 'partner' | 'luz' | 'nico' | 'radio' | 'ada' | 'eli'
export type Line = { speaker: Speaker; text: Labels }

export const objectives: Record<Stage, Labels> = {
  yard: ['Ve a la puerta de tu cabaña.', 'Walk to your cabin door.'],
  hat: ['Cuelga tu sombrero junto a la entrada.', 'Hang your hat by the entrance.'],
  greeting: ['Saluda a Luz y a Nico.', 'Say hello to Luz and Nico.'],
  seat: ['Siéntate a cenar con tu familia.', 'Sit down to dinner with your family.'],
  radio: ['Escucha el aviso de la radio.', 'Listen to the radio announcement.'],
  leave: ['Sal a preguntar cómo están los vecinos.', 'Head out to check on the neighbors.'],
  heat: ['Habla con Ada frente a la casa del techo rojizo.', 'Talk to Ada outside the red-roofed house.'],
  adaWater: ['Ve a tu casa y llena un bidón en el sótano.', 'Go home and fill a water jug in the cellar.'],
  adaReturn: ['Llévale el bidón de agua a Ada.', 'Bring the water jug to Ada.'],
  flood: ['Busca a Eli frente a la casa del techo violeta.', 'Find Eli outside the purple-roofed house.'],
  pier: ['Sigue el sendero central hacia el sur para llegar al muelle.', 'Follow the central path south to the pier.'],
  pierSign: ['Camina hasta el cartel en el lado derecho del muelle.', 'Walk to the sign on the right side of the pier.'],
  pierCoast: ['Presiona E o pulsa «Ver la costa».', 'Press E or select “Look at the coast”.'],
  afterPier: ['Vuelve a la orilla para regresar a casa.', 'Return to shore and head home.'],
  bedtime: ['Vuelve a casa y acuéstate junto a tu pareja.', 'Go home and get into bed beside your partner.'],
  dreamExit: ['Ve a la cocina. Los niños necesitan ayuda.', 'Go to the kitchen. The children need help.'],
  dreamFlood: ['Saca el agua de los tres puntos marcados en la cocina.', 'Bail water out of the three marked spots in the kitchen.'],
  wake: ['Habla con tu pareja.', 'Talk to your partner.'],
  officeGoal: ['Ve a la oficina y abre el expediente de traslado.', 'Go to the office and open the relocation dossier.'],
  complete: ['Vuelve a la oficina para preparar el expediente de traslado.', 'Return to the office to prepare the relocation dossier.'],
  evacuation: ['Entra al PC y solicita un arriendo urgente en DirtBNB.', 'Use the computer to request an urgent rental on DirtBNB.'],
  packing: ['Ayuda a tu familia a preparar sus maletas. Prepara la tuya al final.', 'Help your family pack their bags. Pack your own last.'],
  depart: ['Lleva a tu familia al muelle.', 'Lead your family to the pier.'],
  evacPier: ['Acércate al bote para subir con tu familia.', 'Approach the boat to board with your family.'],
  rowing: ['Alterna los remos y deja atrás la tormenta.', 'Alternate oars and outrun the storm.'],
  escaped: ['Lograste escapar de la tormenta.', 'You escaped the storm.'],
  credits: ['Resultado de la evacuación.', 'Evacuation result.'],
}

export const evacuationBroadcast: Line[] = [
  { speaker: 'radio', text: ['¡Atención, Bramble Cay! Vienen vientos muy fuertes. Todas las familias deben evacuar la isla. Diríjanse al muelle en cuanto estén listas.', 'Attention, Bramble Cay! Dangerous winds are coming. All families must evacuate the island. Head to the pier as soon as you are ready.'] },
  { speaker: 'partner', text: ['Yo reúno a los niños. ¿Ya sabes dónde podríamos ir?', 'I’ll round up the kids. Do you know where we can go?'] },
  { speaker: 'player', text: ['Ya evalué los refugios. Volveré al PC y le escribiré al anfitrión del destino que firmé en el expediente.', 'I’ve assessed the refuges. I’ll go back to the computer and message the host for the destination I signed off on in the dossier.'] },
]

export const packingBrief: Line[] = [
  { speaker: 'partner', text: ['Los niños ya trajeron sus maletas. Ayúdanos a guardar lo imprescindible, prepara la tuya y vamos juntos al muelle.', 'The kids have brought their bags. Help us pack the essentials, pack yours, then we’ll head to the pier together.'] },
]

export const greeting: Line[] = [
  { speaker: 'luz', text: ['¡Volviste! Hoy puse yo los platos. El tuyo tiene la flor pintada.', 'You’re back! I set the table. Yours is the plate with the painted flower.'] },
  { speaker: 'nico', text: ['¡Hay que comer! Te guardé un pan. Bueno… medio pan.', 'Dinner’s ready! I saved you a roll. Well… half a roll.'] },
  { speaker: 'player', text: ['Ven acá, panadero. Los extrañé a los dos.', 'Come here, baker. I missed you both.'] },
]

export const dinner: Line[] = [
  { speaker: 'partner', text: ['Te extrañé hoy. Los niños preguntaron tres veces cuándo volvías.', 'I missed you today. The kids asked three times when you’d be home.'] },
  { speaker: 'partner', text: ['Pasé por lo de Ada. Me dijo que su vecino está muy enfermo. Sus crías también. Me pidió que no llevara a los niños.', 'I stopped by Ada’s. She said her neighbor is very ill. His little ones too. She asked me to keep the kids home.'] },
  { speaker: 'player', text: ['Son tiempos difíciles. Haría lo que fuera por mantenerlos a salvo.', 'These are hard times. I’d do anything to keep you safe.'] },
  { speaker: 'nico', text: ['¿Puedo prender la radio? Quizás está el programa de los barcos.', 'Can I turn on the radio? Maybe the boat show is on.'] },
  { speaker: 'partner', text: ['Sí, cariño. Déjala bajita.', 'Yes, love. Keep it low.'] },
]

export const broadcast: Line[] = [
  { speaker: 'radio', text: ['Interrumpimos la programación para dar un aviso de utilidad pública. Hay familias enfermas y otras han perdido sus casas. Nuestra especie corre un riesgo grave.', 'We interrupt this broadcast for a public service announcement. Families are falling ill and others have lost their homes. Our species is in grave danger.'] },
  { speaker: 'radio', text: ['Todavía no sabemos por qué están muriendo. Busquen agua segura y un lugar donde refugiarse. Si alguien necesita ayuda contactarse con nosotros.', 'We still don’t know why they’re dying. Find safe water and shelter. Let us know if someone needs help.'] },
  { speaker: 'luz', text: ['¿Eso quiere decir que nos puede pasar a nosotros?', 'Does that mean it can happen to us?'] },
  { speaker: 'player', text: ['No lo sé, Luz. Pero te prometo que los cuidaré con mi alma. Primero investigaré para ver qué es lo que está sucediendo. Iré a preguntarles a los vecinos por si saben algo.', 'I don’t know, Luz. But I promise with all my heart that I’ll keep you all safe. First, I’ll look into what’s happening. I’ll ask the neighbors if they know anything.'] },
]

export const heat: Line[] = [
  { speaker: 'player', text: ['Ada, ¿cómo están? Vine a ver si necesitan ayuda.', 'Ada, how are you all doing? I came to see if you need help.'] },
  { speaker: 'ada', text: ['Sentíamos tanto calor que ni a la sombra se nos pasaba. El depósito se vació y casi no quedaba agua para beber.', 'We were so hot that even the shade didn’t help. The tank ran dry and we barely had any water to drink.'] },
  { speaker: 'ada', text: ['¿Te queda agua en tu casa? Con un bidón podríamos aguantar hasta mañana.', 'Do you have any water left at home? A jug would get us through to tomorrow.'] },
  { speaker: 'player', text: ['Guardamos agua en el sótano. Voy a llenarte un bidón y vuelvo enseguida.', 'We keep water in the cellar. I’ll fill a jug and be right back.'] },
]

export const waterDelivery: Line[] = [
  { speaker: 'player', text: ['Aquí tienes, Ada. Lo llené hasta arriba.', 'Here you go, Ada. I filled it right to the top.'] },
  { speaker: 'ada', text: ['Gracias. Los niños van a poder beber esta noche. ¿Supiste lo de la vecina? Es la hermana de Eli.', 'Thank you. The kids will have water tonight. Did you hear about our neighbor? She’s Eli’s sister.'] },
  { speaker: 'ada', text: ['El agua entró en su casa de golpe. Eli estuvo ahí. Vive frente a la casa del techo violeta. Pregúntale a él.', 'Water rushed into her house. Eli was there. You’ll find him outside the purple-roofed house. Ask him what happened.'] },
]

export const flood: Line[] = [
  { speaker: 'eli', text: ['Hola vecino, la casa de mi hermana se inundó de noche. Cuando llegamos, el agua ya había arrancado la puerta.', 'My sister’s house flooded at night. By the time we got there, the water had torn the door off.'] },
  { speaker: 'eli', text: ['Perdió a sus hijos. Todavía pongo dos tazas de más cuando preparo el té. No sé qué hacer.', 'She lost her children. I still set out two extra cups when I make tea. I don’t know what to do.'] },
  { speaker: 'player', text: ['Lo siento, Eli. Puedo quedarme un rato contigo… Después voy a buscar qué cambió en la isla. Quiero que sepamos dónde podemos estar a salvo.', 'I’m so sorry, Eli. I can stay with you a while… Then I’ll look into what changed on the island. I want us to know where we can be safe.'] },
  { speaker: 'eli', text: ['En el muelle hay un letrero con una foto de antes. Nos parábamos ahí a ver la playa. Mira cuánto cambio la altura de la marea en ese sitio.', 'There’s an old photo on the sign at the pier. We used to stand there and look out at the beach. See how much you could see from that same spot.'] },
]

export const bedroomAlarm: Line[] = [
  { speaker: 'luz', text: ['¡Auxilio! ¡Entró agua a la cocina!', 'Help! Water got into the kitchen!'] },
  { speaker: 'nico', text: ['¡Ven rápido! ¡El agua sigue subiendo!', 'Come quick! The water keeps rising!'] },
]

export const floodAlarm: Line[] = [
  { speaker: 'luz', text: ['¡Ayúdame! ¡El agua ya me llega al cuello!', 'Help me! The water is up to my neck!'] },
  { speaker: 'partner', text: ['Estoy sosteniendo a Nico. ¡El agua entró por la puerta!', 'I’m holding on to Nico. It came in through the door!'] },
  { speaker: 'player', text: ['Ya estoy aquí. Voy a sacar el agua con el balde. ¡Aguanten!', 'I’m here. I’ll get the water out with the bucket. Hold on!'] },
]

export const wakingUp: Line[] = [
  { speaker: 'partner', text: ['Estás temblando. Respira. Todo está seco. Los niños siguen durmiendo.', 'You’re shaking. Breathe. Everything’s dry. The kids are still asleep.'] },
  { speaker: 'player', text: ['Soñé que el agua entraba en casa. Después de lo que vi en el muelle, necesito encontrar un lugar seguro para nosotros. Voy a la oficina a revisar los datos.', 'I dreamed the water came into the house. After what I saw at the pier, I need to find somewhere safe for us. I’m going to the office to check the data.'] },
]
