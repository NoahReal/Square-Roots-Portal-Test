// Storage tips and simple ideas for produce that often comes in a Square Roots bundle.
// Each entry is matched to the farm's produce name by the words in `match`
// (so "Yukon Gold potatoes" finds potatoes). Keep ideas simple: few ingredients, basic kitchens.
// To add produce, copy an entry and write it in both languages.

export const RECIPES = [
  {
    match: ['sweet potato'],
    en: {
      name: 'Sweet potatoes',
      store: 'Somewhere cool, dark and dry, not the fridge. They keep 2 to 3 weeks.',
      ideas: ['Bake whole at 400°F for 45 minutes; top with butter or beans.', 'Cube, toss with oil and spices, and roast.'],
    },
    fr: {
      name: 'Patates douces',
      store: 'Dans un endroit frais, sombre et sec, pas au frigo. Elles se gardent 2 à 3 semaines.',
      ideas: ['Cuire entières au four à 400 °F pendant 45 minutes; garnir de beurre ou de haricots.', 'Couper en cubes, enrober d’huile et d’épices, et rôtir.'],
    },
  },
  {
    match: ['potato'],
    en: {
      name: 'Potatoes',
      store: 'Cool, dark and dry, in a paper bag. Keep them away from onions. Cut off any green spots before cooking.',
      ideas: ['Boil, then mash with milk and butter.', 'Cut into wedges, toss with oil and salt, and roast at 425°F for 35 minutes.'],
    },
    fr: {
      name: 'Pommes de terre',
      store: 'Au frais, dans le noir et au sec, dans un sac de papier, loin des oignons. Enlevez les parties vertes avant la cuisson.',
      ideas: ['Faire bouillir, puis écraser avec du lait et du beurre.', 'Couper en quartiers, enrober d’huile et de sel, et rôtir à 425 °F pendant 35 minutes.'],
    },
  },
  {
    match: ['carrot'],
    en: {
      name: 'Carrots',
      store: 'In the fridge, in a bag, with the green tops cut off. Twisted ones taste exactly the same.',
      ideas: ['Roast with a little honey or maple syrup.', 'Simmer with an onion and stock, then blend into soup.'],
    },
    fr: {
      name: 'Carottes',
      store: 'Au frigo, dans un sac, sans les fanes. Les carottes tordues ont exactement le même goût.',
      ideas: ['Rôtir avec un peu de miel ou de sirop d’érable.', 'Mijoter avec un oignon et du bouillon, puis réduire en soupe.'],
    },
  },
  {
    match: ['parsnip'],
    en: {
      name: 'Parsnips',
      store: 'In the fridge, in a bag. They keep for weeks.',
      ideas: ['Roast with carrots; they get sweet.', 'Mash half and half with potatoes.'],
    },
    fr: {
      name: 'Panais',
      store: 'Au frigo, dans un sac. Ils se gardent plusieurs semaines.',
      ideas: ['Rôtir avec des carottes : ils deviennent sucrés.', 'Écraser moitié-moitié avec des pommes de terre.'],
    },
  },
  {
    match: ['beet'],
    en: {
      name: 'Beets',
      store: 'In the fridge, in a bag, with the leaves cut off. The leaves can be cooked like spinach.',
      ideas: ['Wrap in foil and roast at 400°F for about an hour; the skins slip off.', 'Grate raw into a salad with apple.'],
    },
    fr: {
      name: 'Betteraves',
      store: 'Au frigo, dans un sac, sans les feuilles. Les feuilles se cuisinent comme des épinards.',
      ideas: ['Envelopper de papier d’aluminium et rôtir à 400 °F environ une heure; la peau s’enlève facilement.', 'Râper crues dans une salade avec de la pomme.'],
    },
  },
  {
    match: ['apple'],
    en: {
      name: 'Apples',
      store: 'In the fridge, away from other vegetables. Bruised ones are best cooked.',
      ideas: ['Simmer chopped with a splash of water and cinnamon for applesauce.', 'Slice into oatmeal or bake with oats on top.'],
    },
    fr: {
      name: 'Pommes',
      store: 'Au frigo, loin des autres légumes. Les pommes abîmées sont parfaites à cuire.',
      ideas: ['Mijoter en morceaux avec un peu d’eau et de cannelle pour une compote.', 'Trancher dans le gruau, ou cuire au four avec de l’avoine.'],
    },
  },
  {
    match: ['cabbage'],
    en: {
      name: 'Cabbage',
      store: 'Whole in the fridge; it keeps for weeks. Peel off rough outer leaves.',
      ideas: ['Slice thin and fry with onion and a little butter.', 'Shred for coleslaw, or add to soups and stews.'],
    },
    fr: {
      name: 'Chou',
      store: 'Entier au frigo : il se garde des semaines. Enlevez les feuilles extérieures abîmées.',
      ideas: ['Émincer et faire revenir avec de l’oignon et un peu de beurre.', 'Râper en salade de chou, ou ajouter aux soupes et ragoûts.'],
    },
  },
  {
    match: ['onion'],
    en: {
      name: 'Onions',
      store: 'Cool, dark and dry, not in the fridge and not next to potatoes.',
      ideas: ['Cook slowly in butter for 30 minutes until golden and sweet.', 'Start almost any soup, stew or sauce with one.'],
    },
    fr: {
      name: 'Oignons',
      store: 'Au frais, dans le noir et au sec, pas au frigo ni près des pommes de terre.',
      ideas: ['Cuire lentement dans le beurre 30 minutes jusqu’à ce qu’ils soient dorés et sucrés.', 'Commencer presque toutes les soupes, ragoûts ou sauces avec un oignon.'],
    },
  },
  {
    match: ['rutabaga', 'turnip'],
    en: {
      name: 'Rutabaga (turnip)',
      store: 'In the fridge or a cool place. It keeps for weeks.',
      ideas: ['Peel, cube, boil and mash with butter and pepper.', 'Add cubes to stews and boiled dinners.'],
    },
    fr: {
      name: 'Rutabaga (navet)',
      store: 'Au frigo ou dans un endroit frais. Il se garde des semaines.',
      ideas: ['Peler, couper en cubes, faire bouillir et écraser avec du beurre et du poivre.', 'Ajouter en cubes aux ragoûts et aux bouillis.'],
    },
  },
  {
    match: ['squash', 'pumpkin'],
    en: {
      name: 'Squash',
      store: 'On the counter or somewhere cool; whole squash keeps a month or more. Scarred skin doesn’t matter.',
      ideas: ['Cut in half, scoop out the seeds, and roast cut side down at 400°F for 45 minutes.', 'Simmer cubes with onion and stock, then blend into soup.'],
    },
    fr: {
      name: 'Courge',
      store: 'Sur le comptoir ou au frais; entière, elle se garde un mois ou plus. Une peau marquée n’y change rien.',
      ideas: ['Couper en deux, retirer les graines, et rôtir à 400 °F, face coupée vers le bas, pendant 45 minutes.', 'Mijoter en cubes avec un oignon et du bouillon, puis réduire en soupe.'],
    },
  },
  {
    match: ['cucumber'],
    en: {
      name: 'Cucumbers',
      store: 'In the fridge, used within a week.',
      ideas: ['Slice with salt, vinegar and a little sugar for quick pickles.', 'Chop into salads or sandwiches.'],
    },
    fr: {
      name: 'Concombres',
      store: 'Au frigo, à consommer dans la semaine.',
      ideas: ['Trancher avec du sel, du vinaigre et un peu de sucre pour des marinades rapides.', 'Couper dans les salades ou les sandwichs.'],
    },
  },
  {
    match: ['corn'],
    en: {
      name: 'Corn',
      store: 'In the fridge in its husk; eat within a few days.',
      ideas: ['Boil for 5 minutes and add butter.', 'Cut the kernels off into soups, salads or chowder.'],
    },
    fr: {
      name: 'Maïs',
      store: 'Au frigo, dans ses feuilles; à manger d’ici quelques jours.',
      ideas: ['Faire bouillir 5 minutes et ajouter du beurre.', 'Détacher les grains pour les soupes, les salades ou la chaudrée.'],
    },
  },
  {
    match: ['tomato'],
    en: {
      name: 'Tomatoes',
      store: 'On the counter until ripe, then use soon. Soft ones are great for sauce.',
      ideas: ['Simmer with onion and garlic for a pasta sauce.', 'Slice with salt and pepper on toast.'],
    },
    fr: {
      name: 'Tomates',
      store: 'Sur le comptoir jusqu’à maturité, puis à utiliser vite. Les tomates molles sont parfaites en sauce.',
      ideas: ['Mijoter avec de l’oignon et de l’ail pour une sauce à pâtes.', 'Trancher sur une rôtie avec du sel et du poivre.'],
    },
  },
  {
    match: ['zucchini'],
    en: {
      name: 'Zucchini',
      store: 'In the fridge; use within a week.',
      ideas: ['Slice and fry in a little oil with salt.', 'Grate into muffins, pancakes or pasta sauce.'],
    },
    fr: {
      name: 'Courgettes',
      store: 'Au frigo; à utiliser dans la semaine.',
      ideas: ['Trancher et faire revenir dans un peu d’huile avec du sel.', 'Râper dans les muffins, les crêpes ou la sauce à pâtes.'],
    },
  },
  {
    match: ['kale', 'chard', 'spinach', 'greens', 'lettuce'],
    en: {
      name: 'Leafy greens',
      store: 'In the fridge, wrapped in a damp towel in a bag. Use within a few days.',
      ideas: ['Stir into soup or pasta at the end until wilted.', 'Fry with garlic and a little oil.'],
    },
    fr: {
      name: 'Légumes-feuilles',
      store: 'Au frigo, dans un linge humide et un sac. À utiliser d’ici quelques jours.',
      ideas: ['Ajouter à la soupe ou aux pâtes à la fin, le temps qu’ils tombent.', 'Faire revenir avec de l’ail et un peu d’huile.'],
    },
  },
  {
    match: ['broccoli', 'cauliflower'],
    en: {
      name: 'Broccoli and cauliflower',
      store: 'In the fridge, in a loose bag; use within a week.',
      ideas: ['Cut into florets, toss with oil and roast at 425°F for 20 minutes.', 'Steam and add cheese sauce.'],
    },
    fr: {
      name: 'Brocoli et chou-fleur',
      store: 'Au frigo, dans un sac lâche; à utiliser dans la semaine.',
      ideas: ['Couper en bouquets, enrober d’huile et rôtir à 425 °F pendant 20 minutes.', 'Cuire à la vapeur et napper de sauce au fromage.'],
    },
  },
]

// The storage tip and ideas for a farm's produce name, or null if it isn't in the list yet.
export function recipeFor(produceName, lang) {
  const name = produceName.toLowerCase()
  const entry = RECIPES.find((r) => r.match.some((word) => name.includes(word)))
  return entry ? entry[lang] ?? entry.en : null
}
