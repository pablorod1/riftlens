/** DTOs de la API de Riot (solo los campos que usamos). */

export interface AccountDto {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

export interface SummonerDto {
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export type QueueType = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
export type Tier =
  | "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND"
  | "MASTER" | "GRANDMASTER" | "CHALLENGER";
export type Division = "I" | "II" | "III" | "IV";

export interface LeagueEntryDto {
  puuid: string;
  leagueId?: string;
  queueType: QueueType | string;
  tier: Tier;
  rank: Division;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}

export interface LeagueItemDto {
  puuid: string;
  leaguePoints: number;
  rank: Division;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}

export interface LeagueListDto {
  leagueId: string;
  tier: Tier;
  name: string;
  queue: string;
  entries: LeagueItemDto[];
}

export interface PerkStyleSelectionDto {
  perk: number;
  var1: number;
  var2: number;
  var3: number;
}

export interface PerkStyleDto {
  description: "primaryStyle" | "subStyle" | string;
  style: number;
  selections: PerkStyleSelectionDto[];
}

export interface ParticipantDto {
  puuid: string;
  participantId: number;
  teamId: 100 | 200;
  riotIdGameName?: string;
  riotIdTagline?: string;
  championId: number;
  championName: string;
  champLevel: number;
  teamPosition: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "";
  individualPosition: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  visionWardsBoughtInGame: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  perks: { styles: PerkStyleDto[]; statPerks?: { offense: number; flex: number; defense: number } };
  gameEndedInEarlySurrender: boolean;
  gameEndedInSurrender: boolean;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  physicalDamageDealtToChampions?: number;
  magicDamageDealtToChampions?: number;
  trueDamageDealtToChampions?: number;
  totalHeal?: number;
  largestKillingSpree?: number;
  firstBloodKill?: boolean;
  firstBloodAssist?: boolean;
}

export interface TeamDto {
  teamId: 100 | 200;
  win: boolean;
  bans: { championId: number; pickTurn: number }[];
  objectives: Record<string, { first: boolean; kills: number }>;
}

export interface MatchDto {
  metadata: { matchId: string; participants: string[]; dataVersion: string };
  info: {
    gameCreation: number;
    gameStartTimestamp: number;
    gameEndTimestamp?: number;
    gameDuration: number;
    gameMode: string;
    gameType: string;
    gameVersion: string;
    mapId: number;
    platformId: string;
    queueId: number;
    endOfGameResult?: string;
    participants: ParticipantDto[];
    teams: TeamDto[];
  };
}

export interface MatchIdsQuery {
  start?: number;
  count?: number;
  queue?: number;
  type?: "ranked" | "normal" | "tourney" | "tutorial";
  startTime?: number;
  endTime?: number;
}

export interface TimelineParticipantFrame {
  participantId: number;
  currentGold: number;
  totalGold: number;
  xp: number;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
}

export type TimelineEvent =
  | { type: "ITEM_PURCHASED"; timestamp: number; participantId: number; itemId: number }
  | { type: "ITEM_UNDO"; timestamp: number; participantId: number; beforeId: number; afterId: number }
  | { type: "SKILL_LEVEL_UP"; timestamp: number; participantId: number; skillSlot: number; levelUpType: string }
  | { type: string; timestamp: number; participantId?: number };

export interface TimelineDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    frameInterval: number;
    participants?: { participantId: number; puuid: string }[];
    frames: { timestamp: number; participantFrames: Record<string, TimelineParticipantFrame>; events: TimelineEvent[] }[];
  };
}
