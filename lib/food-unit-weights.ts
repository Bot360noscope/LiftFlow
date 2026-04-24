export type UnitName = 'cup' | 'tbsp' | 'tsp' | 'piece' | 'slice' | 'oz';

export const DEFAULT_UNIT_GRAMS: Record<UnitName, number> = {
  cup: 240,
  tbsp: 15,
  tsp: 5,
  piece: 50,
  slice: 30,
  oz: 28,
};

type UnitOverrides = Partial<Record<UnitName, number>>;

interface FoodUnitRule {
  keywords: string[];
  excludes?: string[];
  units: UnitOverrides;
}

const FOOD_UNIT_RULES: FoodUnitRule[] = [
  { keywords: ['rice'], units: { cup: 195, tbsp: 12, tsp: 4 } },
  { keywords: ['quinoa'], units: { cup: 185, tbsp: 12, tsp: 4 } },
  { keywords: ['couscous'], units: { cup: 175, tbsp: 11, tsp: 4 } },
  { keywords: ['pasta', 'spaghetti', 'macaroni', 'penne', 'noodle'], units: { cup: 140, oz: 28 } },
  { keywords: ['oatmeal', 'porridge'], units: { cup: 234, tbsp: 15, tsp: 5 } },
  { keywords: ['oats', 'rolled oats'], units: { cup: 80, tbsp: 5, tsp: 2 } },
  { keywords: ['flour'], units: { cup: 120, tbsp: 8, tsp: 3 } },
  { keywords: ['sugar'], excludes: ['brown'], units: { cup: 200, tbsp: 12, tsp: 4 } },
  { keywords: ['brown sugar'], units: { cup: 220, tbsp: 14, tsp: 5 } },
  { keywords: ['salt'], units: { tbsp: 18, tsp: 6 } },
  { keywords: ['honey'], units: { cup: 340, tbsp: 21, tsp: 7 } },
  { keywords: ['maple syrup', 'syrup'], units: { cup: 322, tbsp: 20, tsp: 7 } },
  { keywords: ['olive oil', 'vegetable oil', 'canola oil', 'oil'], units: { cup: 218, tbsp: 14, tsp: 5 } },
  { keywords: ['butter'], units: { cup: 227, tbsp: 14, tsp: 5, piece: 14 } },
  { keywords: ['peanut butter', 'almond butter', 'nut butter'], units: { cup: 258, tbsp: 16, tsp: 5 } },
  { keywords: ['mayonnaise', 'mayo'], units: { cup: 220, tbsp: 14, tsp: 5 } },
  { keywords: ['ketchup'], units: { cup: 245, tbsp: 17, tsp: 6 } },
  { keywords: ['mustard'], units: { cup: 249, tbsp: 16, tsp: 5 } },
  { keywords: ['soy sauce'], units: { cup: 255, tbsp: 16, tsp: 5 } },

  { keywords: ['milk'], excludes: ['powder'], units: { cup: 240, tbsp: 15, tsp: 5, oz: 30 } },
  { keywords: ['yogurt', 'yoghurt'], units: { cup: 245, tbsp: 15, oz: 28 } },
  { keywords: ['cottage cheese'], units: { cup: 225, tbsp: 14, oz: 28 } },
  { keywords: ['cream cheese'], units: { cup: 232, tbsp: 14, tsp: 5, oz: 28 } },
  { keywords: ['cheese'], units: { cup: 113, tbsp: 7, slice: 20, oz: 28 } },
  { keywords: ['cream', 'heavy cream'], excludes: ['cheese', 'ice'], units: { cup: 240, tbsp: 15, tsp: 5 } },

  { keywords: ['egg'], excludes: ['plant'], units: { piece: 50, cup: 243 } },

  { keywords: ['chicken breast'], units: { piece: 170, slice: 30, oz: 28, cup: 140 } },
  { keywords: ['chicken thigh'], units: { piece: 110, oz: 28, cup: 140 } },
  { keywords: ['chicken'], units: { piece: 140, slice: 30, oz: 28, cup: 140 } },
  { keywords: ['turkey'], units: { slice: 28, piece: 85, oz: 28, cup: 140 } },
  { keywords: ['bacon'], units: { slice: 8, piece: 8, oz: 28 } },
  { keywords: ['sausage'], units: { piece: 75, slice: 27, oz: 28 } },
  { keywords: ['ham'], units: { slice: 28, piece: 85, oz: 28, cup: 140 } },
  { keywords: ['beef', 'steak', 'ground beef'], units: { piece: 85, slice: 28, oz: 28, cup: 140 } },
  { keywords: ['pork'], units: { piece: 85, slice: 28, oz: 28, cup: 140 } },
  { keywords: ['lamb'], units: { piece: 85, slice: 28, oz: 28, cup: 140 } },
  { keywords: ['salmon'], units: { piece: 170, slice: 28, oz: 28 } },
  { keywords: ['tuna'], units: { piece: 85, oz: 28, cup: 154 } },
  { keywords: ['shrimp', 'prawn'], units: { piece: 7, cup: 145, oz: 28 } },
  { keywords: ['fish'], units: { piece: 140, slice: 28, oz: 28 } },
  { keywords: ['tofu'], units: { piece: 85, slice: 30, cup: 252, oz: 28 } },
  { keywords: ['tempeh'], units: { piece: 85, slice: 30, cup: 166, oz: 28 } },

  { keywords: ['bread', 'toast'], units: { slice: 28, piece: 28, oz: 28 } },
  { keywords: ['bagel'], units: { piece: 105, slice: 26 } },
  { keywords: ['tortilla'], units: { piece: 49, slice: 49 } },
  { keywords: ['pancake'], units: { piece: 38, slice: 38 } },
  { keywords: ['waffle'], units: { piece: 75, slice: 75 } },
  { keywords: ['pizza'], units: { slice: 107, piece: 107, oz: 28 } },
  { keywords: ['cracker'], units: { piece: 3, oz: 28, cup: 60 } },
  { keywords: ['cookie'], units: { piece: 16, oz: 28, cup: 110 } },
  { keywords: ['muffin'], units: { piece: 113, oz: 28 } },
  { keywords: ['donut', 'doughnut'], units: { piece: 60, oz: 28 } },
  { keywords: ['chocolate'], units: { piece: 10, slice: 10, oz: 28, cup: 175 } },

  { keywords: ['banana'], units: { piece: 118, slice: 6, cup: 150, oz: 28 } },
  { keywords: ['apple'], excludes: ['juice', 'sauce'], units: { piece: 180, slice: 11, cup: 125, oz: 28 } },
  { keywords: ['orange'], excludes: ['juice'], units: { piece: 130, slice: 10, cup: 180, oz: 28 } },
  { keywords: ['pear'], units: { piece: 178, slice: 11, cup: 140, oz: 28 } },
  { keywords: ['peach'], units: { piece: 150, slice: 19, cup: 154, oz: 28 } },
  { keywords: ['strawberry', 'strawberries'], units: { piece: 12, cup: 144, oz: 28 } },
  { keywords: ['blueberry', 'blueberries'], units: { piece: 1, cup: 148, oz: 28 } },
  { keywords: ['raspberry', 'raspberries'], units: { piece: 2, cup: 123, oz: 28 } },
  { keywords: ['grape'], excludes: ['juice'], units: { piece: 5, cup: 151, oz: 28 } },
  { keywords: ['watermelon'], units: { cup: 152, slice: 286, oz: 28 } },
  { keywords: ['mango'], units: { piece: 200, slice: 21, cup: 165, oz: 28 } },
  { keywords: ['pineapple'], units: { slice: 56, cup: 165, piece: 905, oz: 28 } },
  { keywords: ['avocado'], units: { piece: 200, slice: 15, cup: 150, oz: 28 } },
  { keywords: ['lemon'], units: { piece: 58, slice: 8, oz: 28 } },
  { keywords: ['lime'], units: { piece: 67, slice: 8, oz: 28 } },
  { keywords: ['kiwi'], units: { piece: 69, slice: 8, cup: 180, oz: 28 } },

  { keywords: ['tomato'], excludes: ['sauce', 'paste', 'soup'], units: { piece: 123, slice: 20, cup: 180, oz: 28 } },
  { keywords: ['carrot'], units: { piece: 61, slice: 5, cup: 128, oz: 28 } },
  { keywords: ['cucumber'], units: { piece: 301, slice: 7, cup: 119, oz: 28 } },
  { keywords: ['onion'], units: { piece: 110, slice: 14, cup: 160, oz: 28 } },
  { keywords: ['bell pepper', 'pepper'], excludes: ['black', 'cayenne', 'chili powder'], units: { piece: 119, slice: 14, cup: 149, oz: 28 } },
  { keywords: ['potato'], excludes: ['sweet', 'chip', 'crisp'], units: { piece: 173, slice: 20, cup: 150, oz: 28 } },
  { keywords: ['sweet potato'], units: { piece: 130, slice: 20, cup: 200, oz: 28 } },
  { keywords: ['broccoli'], units: { piece: 8, cup: 91, oz: 28 } },
  { keywords: ['cauliflower'], units: { piece: 13, cup: 107, oz: 28 } },
  { keywords: ['spinach'], units: { cup: 30, oz: 28 } },
  { keywords: ['kale'], units: { cup: 21, oz: 28 } },
  { keywords: ['lettuce'], units: { cup: 36, slice: 5, oz: 28 } },
  { keywords: ['mushroom'], units: { piece: 18, slice: 5, cup: 70, oz: 28 } },
  { keywords: ['zucchini'], units: { piece: 196, slice: 9, cup: 124, oz: 28 } },
  { keywords: ['corn'], units: { piece: 90, cup: 145, oz: 28 } },
  { keywords: ['peas'], units: { cup: 145, oz: 28 } },
  { keywords: ['bean', 'lentil', 'chickpea', 'garbanzo'], units: { cup: 170, tbsp: 11, oz: 28 } },

  { keywords: ['almond'], excludes: ['butter', 'milk', 'flour'], units: { piece: 1, cup: 143, tbsp: 9, oz: 28 } },
  { keywords: ['walnut'], excludes: ['oil'], units: { piece: 4, cup: 117, tbsp: 7, oz: 28 } },
  { keywords: ['cashew'], excludes: ['butter', 'milk'], units: { piece: 1, cup: 137, tbsp: 9, oz: 28 } },
  { keywords: ['pecan'], units: { piece: 1, cup: 109, tbsp: 7, oz: 28 } },
  { keywords: ['pistachio'], units: { piece: 1, cup: 123, tbsp: 8, oz: 28 } },
  { keywords: ['peanut'], excludes: ['butter', 'oil'], units: { piece: 1, cup: 146, tbsp: 9, oz: 28 } },
  { keywords: ['nut'], excludes: ['butter', 'meg'], units: { piece: 1, cup: 140, tbsp: 9, oz: 28 } },
  { keywords: ['raisin'], units: { piece: 1, cup: 165, tbsp: 10, oz: 28 } },
  { keywords: ['date'], units: { piece: 8, cup: 178, oz: 28 } },
  { keywords: ['seed', 'chia', 'flax', 'sunflower seed', 'pumpkin seed'], units: { tbsp: 10, tsp: 3, cup: 160, oz: 28 } },

  { keywords: ['juice'], units: { cup: 248, tbsp: 15, tsp: 5, oz: 30 } },
  { keywords: ['water'], excludes: ['melon', 'cress', 'chestnut'], units: { cup: 237, tbsp: 15, tsp: 5, oz: 30 } },
  { keywords: ['coffee', 'tea'], units: { cup: 237, tbsp: 15, tsp: 5, oz: 30 } },
  { keywords: ['soup', 'broth', 'stock'], units: { cup: 245, tbsp: 15, tsp: 5, oz: 30 } },
  { keywords: ['ice cream'], units: { cup: 132, tbsp: 8, oz: 28 } },
];

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

function findRule(foodName: string): FoodUnitRule | null {
  const lower = normalize(foodName);
  if (!lower) return null;

  let best: { rule: FoodUnitRule; score: number } | null = null;
  for (const rule of FOOD_UNIT_RULES) {
    if (rule.excludes && rule.excludes.some(ex => lower.includes(ex))) continue;
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        const score = keyword.length;
        if (!best || score > best.score) {
          best = { rule, score };
        }
        break;
      }
    }
  }
  return best?.rule ?? null;
}

export function getUnitGramsForFood(foodName: string | undefined | null, unit: UnitName): number {
  if (foodName) {
    const rule = findRule(foodName);
    const override = rule?.units[unit];
    if (typeof override === 'number' && override > 0) return override;
  }
  return DEFAULT_UNIT_GRAMS[unit];
}

export function getUnitChipsForFood(foodName: string | undefined | null): { name: UnitName; grams: string }[] {
  const units: UnitName[] = ['cup', 'tbsp', 'tsp', 'piece', 'slice', 'oz'];
  return units.map(name => ({ name, grams: String(getUnitGramsForFood(foodName, name)) }));
}
