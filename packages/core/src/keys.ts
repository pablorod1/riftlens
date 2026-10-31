/** "Nombre#TAG" -> "nombre#tag": clave para buscar sin distinguir mayúsculas. */
export const riotIdKey = (gameName: string, tagLine: string) => `${gameName.trim()}#${tagLine.trim()}`.toLowerCase();
