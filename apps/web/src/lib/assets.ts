const CDRAGON = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default";

export const rankEmblem = (tier: string) => `${CDRAGON}/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
export const rankCrest = (tier: string) => `${CDRAGON}/images/ranked-mini-crests/${tier.toLowerCase()}.svg`;
export const positionIcon = (position: string) => {
  const map: Record<string, string> = { TOP: "top", JUNGLE: "jungle", MIDDLE: "middle", BOTTOM: "bottom", UTILITY: "utility" };
  return map[position] ? `${CDRAGON}/svg/position-${map[position]}.svg` : null;
};
