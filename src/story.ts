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
  flood: ['Busca a Eli junto a la casa del techo verde.', 'Find Eli by the green-roofed house.'],
  pier: ['Ve a la entrada del muelle, al sur de la casa verde.', 'Go to the pier entrance, south of the green house.'],
  pierSign: ['Camina hasta el cartel en el lado derecho del muelle.', 'Walk to the sign on the right side of the pier.'],
  pierCoast: ['Presiona E o pulsa «Ver la costa».', 'Press E or select “Look at the coast”.'],
  complete: ['Puedes volver a observar la costa desde el muelle.', 'You can look out at the coast again from the pier.'],
}

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
  { speaker: 'radio', text: ['Interrumpimos la programación. Hay familias enfermas y otras han perdido sus casas. Nuestra especie corre un riesgo grave.', 'We interrupt this broadcast. Families are falling ill and others have lost their homes. Our species is in grave danger.'] },
  { speaker: 'radio', text: ['Todavía no sabemos por qué están muriendo. Busquen agua segura y un lugar donde refugiarse. Avisen si alguien necesita ayuda.', 'We still don’t know why they’re dying. Find safe water and shelter. Let us know if someone needs help.'] },
  { speaker: 'luz', text: ['¿Eso quiere decir que nos puede pasar a nosotros?', 'Does that mean it can happen to us?'] },
  { speaker: 'player', text: ['No lo sé, Luz. En mi trabajo de ingeniería empiezo midiendo. Aquí voy a empezar escuchando. Les preguntaré a los vecinos qué pasó, dónde y cuándo.', 'I don’t know, Luz. As an engineer, I start by measuring. Here I’ll start by listening. I’ll ask the neighbors what happened, where and when.'] },
]

export const heat: Line[] = [
  { speaker: 'player', text: ['Ada, ¿cómo están? Vine a ver si necesitan ayuda.', 'Ada, how are you all doing? I came to see if you need help.'] },
  { speaker: 'ada', text: ['Sentíamos tanto calor que ni a la sombra se nos pasaba. El depósito se vació y casi no quedaba agua para beber.', 'We were so hot that even the shade didn’t help. The tank ran dry and we barely had any water to drink.'] },
  { speaker: 'player', text: ['¿Desde cuándo se sienten así? Voy a anotarlo. ¿Sabes si a alguien más le pasó?', 'When did it start? I’ll write it down. Do you know if it happened to anyone else?'] },
  { speaker: 'ada', text: ['Desde hace unos días. Busca a Eli, junto a la casa verde. Lo de su familia fue distinto.', 'A few days ago. Find Eli by the green house. Something different happened to his family.'] },
]

export const flood: Line[] = [
  { speaker: 'eli', text: ['La casa de mi hermana se inundó de noche. Cuando llegamos, el agua ya había arrancado la puerta.', 'My sister’s house flooded at night. By the time we got there, the water had torn the door off.'] },
  { speaker: 'eli', text: ['Perdió a sus hijos. Todavía pongo dos tazas de más cuando preparo el té. No sé qué hacer.', 'She lost her children. I still set out two extra cups when I make tea. I don’t know what to do.'] },
  { speaker: 'player', text: ['Lo siento, Eli. Puedo quedarme un rato contigo… Después voy a buscar qué cambió en la isla. Quiero que sepamos dónde podemos estar a salvo.', 'I’m so sorry, Eli. I can stay with you a while… Then I’ll look into what changed on the island. I want us to know where we can be safe.'] },
  { speaker: 'eli', text: ['En el muelle hay un letrero con una foto de antes. Nos parábamos ahí a ver la playa. Mira cuánto llegaba a verse desde ese mismo sitio.', 'There’s an old photo on the sign at the pier. We used to stand there and look out at the beach. See how much you could see from that same spot.'] },
]
