/* Companion-planting database.
 * Compiled from widely published companion-planting guidance (e.g. "Carrots Love
 * Tomatoes" tradition, three-sisters planting, common organic-gardening references).
 * These are traditional guidelines, not guarantees — soil, climate and variety matter.
 * 100% local: no network, no accounts.
 */

const COMPANION_DB = [
  {
    name: "Tomato",
    friends: [
      ["Basil", "Classic pairing; basil is said to repel tomato hornworms and improve flavour."],
      ["Marigold", "Root exudates deter nematodes and whitefly."],
      ["Carrot", "Tomatoes shade soil and may deter carrot pests."],
      ["Onion", "Onions repel aphids and other tomato pests."],
      ["Parsley", "Attracts beneficial hoverflies that eat aphids."]
    ],
    foes: [
      ["Corn", "Share pests (tomato fruitworm / corn earworm)."],
      ["Fennel", "Allelopathic; inhibits the growth of most neighbours."],
      ["Potato", "Both nightshades; blight spreads easily between them."],
      ["Cabbage", "Competes heavily and may stunt tomato growth."]
    ]
  },
  {
    name: "Basil",
    friends: [
      ["Tomato", "Mutual classic; pest confusion and flavour."],
      ["Peppers", "Similar needs; basil repels aphids and spider mites."],
      ["Asparagus", "Repels asparagus beetle."]
    ],
    foes: [
      ["Rue", "Rue is reported to inhibit basil growth."],
      ["Sage", "Competing aromatic herbs; growth can suffer."]
    ]
  },
  {
    name: "Carrot",
    friends: [
      ["Onion", "Onion scent masks carrots from carrot fly — the famous duo."],
      ["Tomato", "Tomatoes may deter carrot pests; carrots break up soil."],
      ["Lettuce", "Lettuce shades soil, keeping it cool for carrots."],
      ["Rosemary", "Repels carrot fly."]
    ],
    foes: [
      ["Dill", "Cross-pollinates with carrots, ruining seed and flavour."],
      ["Parsnip", "Competes for the same soil zone and nutrients."]
    ]
  },
  {
    name: "Onion",
    friends: [
      ["Carrot", "Mutual pest masking (carrot fly / onion fly)."],
      ["Tomato", "Repels aphids around tomatoes."],
      ["Lettuce", "Pest protection with no root competition."],
      ["Cabbage", "Deters cabbage pests."]
    ],
    foes: [
      ["Beans", "Alliums inhibit legume growth."],
      ["Peas", "Alliums inhibit legume growth."]
    ]
  },
  {
    name: "Garlic",
    friends: [
      ["Tomato", "Repels spider mites and aphids."],
      ["Peppers", "General pest repellent."],
      ["Cabbage", "Deters cabbage worms and aphids."]
    ],
    foes: [
      ["Beans", "Alliums inhibit legume growth."],
      ["Peas", "Alliums inhibit legume growth."]
    ]
  },
  {
    name: "Beans (bush)",
    friends: [
      ["Corn", "Beans fix nitrogen that heavy-feeding corn loves."],
      ["Carrot", "Complementary root depths."],
      ["Cucumber", "Beans enrich soil; cucumbers benefit."],
      ["Potato", "Mutual pest confusion."]
    ],
    foes: [
      ["Onion", "Alliums stunt bean growth."],
      ["Garlic", "Alliums stunt bean growth."],
      ["Fennel", "Allelopathic inhibition."]
    ]
  },
  {
    name: "Corn",
    friends: [
      ["Beans (bush)", "Three sisters: beans fix nitrogen for corn."],
      ["Squash", "Three sisters: squash shades soil, deters raccoons."],
      ["Cucumber", "Corn stalks can trellis cucumbers."]
    ],
    foes: [
      ["Tomato", "Shared earworm/fruitworm pests."]
    ]
  },
  {
    name: "Squash",
    friends: [
      ["Corn", "Three sisters pairing."],
      ["Beans (bush)", "Three sisters pairing."],
      ["Marigold", "Deters squash bugs and nematodes."]
    ],
    foes: [
      ["Potato", "Heavy feeders that compete aggressively."]
    ]
  },
  {
    name: "Cucumber",
    friends: [
      ["Beans (bush)", "Nitrogen boost for heavy-feeding cucumbers."],
      ["Corn", "Natural trellis."],
      ["Peas", "Nitrogen fixation."],
      ["Radish", "Radishes deter cucumber beetles."]
    ],
    foes: [
      ["Sage", "Aromatic oils can stunt cucumber growth."],
      ["Potato", "Compete for water and nutrients."]
    ]
  },
  {
    name: "Lettuce",
    friends: [
      ["Carrot", "Carrots loosen soil; lettuce shades it."],
      ["Onion", "Pest protection."],
      ["Radish", "Radishes mature fast and mark rows."],
      ["Strawberry", "Ground cover that keeps berries clean."]
    ],
    foes: [
      ["Cabbage", "Cabbage can overshadow and outcompete lettuce."]
    ]
  },
  {
    name: "Marigold",
    friends: [
      ["Tomato", "Nematode and whitefly suppression."],
      ["Squash", "Deters squash bugs."],
      ["Cabbage", "Repels cabbage moths."],
      ["Cucumber", "General pest confusion."]
    ],
    foes: [
      ["Beans (bush)", "Some gardeners report marigolds inhibit bean growth."]
    ]
  },
  {
    name: "Peppers",
    friends: [
      ["Basil", "Repels aphids and spider mites."],
      ["Onion", "Pest protection."],
      ["Tomato", "Similar needs; mutual shelter."]
    ],
    foes: [
      ["Fennel", "Allelopathic inhibition."],
      ["Beans (bush)", "Can compete for nutrients."]
    ]
  },
  {
    name: "Cabbage",
    friends: [
      ["Dill", "Dill attracts wasps that prey on cabbage worms."],
      ["Onion", "Masks cabbage from pests."],
      ["Potato", "Complementary feeding habits."]
    ],
    foes: [
      ["Tomato", "Tomatoes can stunt brassica growth."],
      ["Strawberry", "Compete for nutrients."],
      ["Beans (bush)", "Cabbage inhibits bean growth in some soils."]
    ]
  },
  {
    name: "Potato",
    friends: [
      ["Beans (bush)", "Nitrogen fixers feed hungry potatoes."],
      ["Corn", "Mutual pest confusion."],
      ["Cabbage", "Complementary habits."]
    ],
    foes: [
      ["Tomato", "Late blight jumps between nightshades."],
      ["Cucumber", "Heavy competition for water."],
      ["Squash", "Heavy competition for water."]
    ]
  },
  {
    name: "Dill",
    friends: [
      ["Cabbage", "Attracts beneficial wasps."],
      ["Cucumber", "Improves vigour in small amounts."]
    ],
    foes: [
      ["Carrot", "Cross-pollination ruins both."],
      ["Tomato", "Mature dill can stunt tomatoes."]
    ]
  },
  {
    name: "Fennel",
    friends: [],
    foes: [
      ["Tomato", "Strong allelopathic inhibition."],
      ["Beans (bush)", "Strong allelopathic inhibition."],
      ["Cabbage", "Inhibits brassica growth."],
      ["Peppers", "Inhibits growth."]
    ]
  },
  {
    name: "Radish",
    friends: [
      ["Cucumber", "Deters cucumber beetles."],
      ["Lettuce", "Fast marker crop."],
      ["Carrot", "Breaks soil crust for carrots."]
    ],
    foes: [
      ["Hyssop", "Reported to inhibit radish growth."]
    ]
  },
  {
    name: "Spinach",
    friends: [
      ["Strawberry", "Living mulch under berries."],
      ["Beans (bush)", "Nitrogen boost for leafy growth."]
    ],
    foes: [
      ["Potato", "Potatoes outcompete spinach for nutrients."]
    ]
  },
  {
    name: "Strawberry",
    friends: [
      ["Lettuce", "Ground cover keeps berries off soil."],
      ["Spinach", "Living mulch."],
      ["Beans (bush)", "Nitrogen for fruiting."]
    ],
    foes: [
      ["Cabbage", "Compete for nutrients and space."]
    ]
  },
  {
    name: "Sunflower",
    friends: [
      ["Cucumber", "Stalk trellis and pollinator magnet."],
      ["Corn", "Shared pollinator benefits."]
    ],
    foes: [
      ["Potato", "Allelopathic to potatoes."],
      ["Beans (bush)", "Shades out low beans."]
    ]
  },
  {
    name: "Rosemary",
    friends: [
      ["Cabbage", "Repels cabbage moths."],
      ["Carrot", "Repels carrot fly."],
      ["Beans (bush)", "General pest deterrent."]
    ],
    foes: [
      ["Cucumber", "Can stunt cucumber growth."],
      ["Squash", "Can stunt squash growth."]
    ]
  },
  {
    name: "Thyme",
    friends: [
      ["Cabbage", "Repels cabbage worms."],
      ["Tomato", "Deters tomato pests."]
    ],
    foes: []
  },
  {
    name: "Peas",
    friends: [
      ["Carrot", "Complementary roots."],
      ["Cucumber", "Nitrogen fixation."],
      ["Corn", "Trellis support."]
    ],
    foes: [
      ["Onion", "Alliums inhibit legumes."],
      ["Garlic", "Alliums inhibit legumes."]
    ]
  },
  {
    name: "Beets",
    friends: [
      ["Onion", "Pest protection, no competition."],
      ["Lettuce", "Complementary canopy."],
      ["Cabbage", "Improves beet growth."]
    ],
    foes: [
      ["Beans (bush)", "Pole beans especially compete with beets."]
    ]
  },
  {
    name: "Hyssop",
    friends: [
      ["Cabbage", "Attracts cabbage-moth predators."],
      ["Grapes", "Traditional pairing."]
    ],
    foes: [
      ["Radish", "Inhibits radish growth."]
    ]
  }
];

/* Lookup helpers */
function getPlant(name) {
  return COMPANION_DB.find(p => p.name === name) || null;
}

/* Returns "friend" | "foe" | "neutral" for the pair (checks both directions). */
function relationOf(a, b) {
  if (!a || !b || a === b) return "neutral";
  const pa = getPlant(a), pb = getPlant(b);
  if (!pa || !pb) return "neutral";
  const aFoe = pa.foes.some(([n]) => n === b);
  const bFoe = pb.foes.some(([n]) => n === a);
  if (aFoe || bFoe) return "foe";
  const aFriend = pa.friends.some(([n]) => n === b);
  const bFriend = pb.friends.some(([n]) => n === a);
  if (aFriend || bFriend) return "friend";
  return "neutral";
}
