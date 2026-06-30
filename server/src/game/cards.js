// "الحظ" (luck/surprise) and treasure-chest card decks.

export const SURPRISE_CARDS = [
  { id: "s1", text: "مخالفة موقف! ادفع 40 عملة.", effect: { type: "pay", amount: 40 } },
  { id: "s2", text: "ضرر حفرة في الطريق! ادفع 15 عملة عن كل منزل و50 عن كل فندق.", effect: { type: "repair", house: 15, hotel: 50 } },
  { id: "s3", text: "مخالفة عبور مشاة. ادفع 50 عملة.", effect: { type: "pay", amount: 50 } },
  { id: "s4", text: "تقدم إلى البداية واحصل على 200 عملة.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "s5", text: "اذهب مباشرة إلى الحبس.", effect: { type: "goToHolding" } },
  { id: "s6", text: "ارجع 3 مربعات إلى الخلف.", effect: { type: "move", steps: -3 } },
  { id: "s7", text: "ادفع 25 عملة لكل لاعب.", effect: { type: "payEachPlayer", amount: 25 } },
];

export const TREASURE_CARDS = [
  { id: "t1", text: "استرداد ضريبي! احصل على 20 عملة.", effect: { type: "collect", amount: 20 } },
  { id: "t2", text: "وجدت تذكرة يانصيب! احصل على 100 عملة.", effect: { type: "collect", amount: 100 } },
  { id: "t3", text: "هدية عيد ميلاد! احصل على 10 عملات من كل لاعب.", effect: { type: "collectFromEachPlayer", amount: 10 } },
  { id: "t4", text: "بعت لوحة قديمة. احصل على 50 عملة.", effect: { type: "collect", amount: 50 } },
  { id: "t5", text: "تقدم إلى البداية واحصل على 200 عملة.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "t6", text: "اخرج من الحبس مجانًا.", effect: { type: "getOutFree" } },
  { id: "t7", text: "نضج استثمارك! احصل على 150 عملة.", effect: { type: "collect", amount: 150 } },
];

export function shuffledDeck(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
