// Display layer ("skin") for the 6 generic archetypes defined server-side in
// server/src/game/characters.js. Deliberately decoupled from ability logic --
// nothing here affects gameplay, only what a player sees. Names/descriptions
// are placeholder wording to be refined later; portraits are simple original
// placeholder icons (client/public/characters/<id>/v1.svg, v2.svg), not real
// photos, so this whole file (and its assets) is safe to keep in an
// open-sourced copy of this repo. Swap in a different name/description/image
// set here -- e.g. a private "friend group" skin -- without touching the
// server or any other component.
//
// Each `actives[]` entry's `id`/`cooldownTurns` must match the matching entry
// in server/src/game/characters.js's ABILITIES registry -- the id is what
// gets sent in the `useAbility` socket event, and cooldownTurns is shown here
// purely for display (the live remaining-cooldown value comes from
// player.abilityCooldowns on the server, not from this file).
export const CHARACTERS = [
  {
    id: "don",
    name: "الدون",
    description: "يسيطر على منطقة من اللوحة ويفرض ضريبة على البنك نفسه.",
    passive:
      "يحتكر منطقة — أي لاعب يحط عليها يدفع له رسومًا إضافية فوق الإيجار العادي. كما يأخذ 50% من كل ضريبة يجمعها البنك في أي مكان على اللوحة.",
    actives: [
      {
        id: "barricade",
        label: "الحاجز",
        cooldownTurns: 10,
        text: "يضع حاجزًا على أي مربع يختاره — لبقية تلك الجولة، أي لاعب كان مساره سيتخطى ذلك المربع يتوقف عنده بدلاً من ذلك ويطبَّق عليه تأثير المربع كاملاً.",
      },
    ],
    v1: "/characters/don/v1.svg",
    v2: "/characters/don/v2.svg",
  },
  {
    id: "enforcer",
    name: "المنفّذ",
    description: "سمسار صامت. لا يربح شيئًا إلا إذا تحركت الطاولة.",
    passive:
      "يأخذ 5% من قيمة كل صفقة تبادل تتم، و5% من كل ضريبة تُدفع — كلها من البنك، وليست رسومًا إضافية على اللاعبين.",
    actives: [
      {
        id: "curse",
        label: "اللعنة",
        cooldownTurns: 7,
        text: "يستهدف أي لاعب — لبقية تلك الجولة، كل ما كان سيكسبه ذلك اللاعب يذهب للمنفّذ بدلاً منه. لا يمكنه دفع رسوم الخروج المبكر من الحبس، يجب أن ينتظر المدة كاملة دائمًا.",
      },
    ],
    v1: "/characters/enforcer/v1.svg",
    v2: "/characters/enforcer/v2.svg",
  },
  {
    id: "wrecker",
    name: "الهدّام",
    description: "يسوّي كل ما في طريقه بالأرض. ضربة واحدة، كل الطوابق.",
    passive: "يحصل على 50 عملة من البنك في كل مرة يهدم فيها أي لاعب مبنى أو يرهن عقارًا (لا يحتسب بيع أرض فارغة).",
    actives: [
      {
        id: "detonate",
        label: "التفجير",
        cooldownTurns: 3,
        text: "يدمر كل ما بُني على عقار مستهدف دفعة واحدة. تُشحن قدرته حسب حجم الهدم: من 3 جولات (أرض فارغة تُرهن قسرًا) حتى 9 جولات (فندق كامل).",
      },
    ],
    v1: "/characters/wrecker/v1.svg",
    v2: "/characters/wrecker/v2.svg",
  },
  {
    id: "kingpin",
    name: "العقل المدبر",
    description: "موسّع أراضٍ. الحدود بالنسبة له مجرد اقتراحات.",
    passive: "يتتبع كل هبوط على منطقته — كل هبوط ثالث (بشكل دوري ثابت) يمنحه 90% من أرباح ذلك الهبوط.",
    actives: [
      {
        id: "flankSeizure",
        label: "الاستيلاء الجانبي",
        cooldownTurns: 12,
        text: "يستولي على أقرب عقارين قابلين للتملك على جانبي عقار يملكه بالفعل.",
      },
      {
        id: "hostileTakeover",
        label: "الاستحواذ العدائي",
        cooldownTurns: 7,
        text: "يسيطر على أي مربع واحد لبقية الجولة الحالية فقط، ثم يعود لصاحبه الأصلي.",
      },
    ],
    v1: "/characters/kingpin/v1.svg",
    v2: "/characters/kingpin/v2.svg",
  },
  {
    id: "conductor",
    name: "الكمساري",
    description: "يملك كل المحطات. يلاحق أصحاب أكبر الإمبراطوريات.",
    passive:
      "يأخذ حصة من إيجار أي محطة يدفعها أي لاعب، بغض النظر عن المالك. وإذا كان هو صاحب المحطة، يجمع 1.5× الإيجار.",
    actives: [
      {
        id: "wreckingTour",
        label: "جولة الهدم",
        cooldownTurns: 8,
        text: "يرسل حافلة تجوب اللوحة من موضعه الحالي، تهدم مستويين من كل عقار تمر به حتى تصل إلى محطة الكوستر التالية.",
      },
    ],
    v1: "/characters/conductor/v1.svg",
    v2: "/characters/conductor/v2.svg",
  },
  {
    id: "fixer",
    name: "المُصلح",
    description: "يحب البنك. ويصادق الخطرين منهم.",
    passive: "يحصل على مكافأة ثابتة في كل مرة يدفع فيها البنك مباشرة — عند المرور بالبداية، أو من مكافآت البطاقات.",
    actives: [
      {
        id: "heist",
        label: "السرقة",
        cooldownTurns: 5,
        text: "يسرق قدرة لاعب آخر ويستخدمها مرة واحدة فورًا كأنها قدرته. تُشحن قدرته خلال 5 جولات زائد نصف مدة شحن القدرة المسروقة.",
      },
    ],
    v1: "/characters/fixer/v1.svg",
    v2: "/characters/fixer/v2.svg",
  },
];
