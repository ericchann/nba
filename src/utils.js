import playerIds from './player_ids.json';

export const teamSlugMap = {
  ATL: 'hawks',
  BOS: 'celtics',
  BKN: 'nets',
  CHA: 'hornets',
  CHI: 'bulls',
  CLE: 'cavaliers',
  DAL: 'mavericks',
  DEN: 'nuggets',
  DET: 'pistons',
  GSW: 'warriors',
  HOU: 'rockets',
  IND: 'pacers',
  LAC: 'clippers',
  LAL: 'lakers',
  MEM: 'grizzlies',
  MIA: 'heat',
  MIL: 'bucks',
  MIN: 'timberwolves',
  NOP: 'pelicans',
  NYK: 'knicks',
  OKC: 'thunder',
  ORL: 'magic',
  PHI: '76ers',
  PHX: 'suns',
  POR: 'trail-blazers',
  SAC: 'kings',
  SAS: 'spurs',
  TOR: 'raptors',
  UTA: 'jazz',
  WSH: 'wizards',
};

/*
  This helper:
    1. Normalizes the player name (removing accent marks)
    2. Compares the normalized name (in lowercase) with the keys in player_ids.json (which may use Unicode escapes)
    3. If a match is found, returns the NBA.com headshot URL using the player id.
    4. If no match is found, falls back to the Showstone URL.
*/
export function getPlayerPhotoUrl(playerName) {
  if (!playerName || typeof playerName !== 'string') {
    return 'https://via.placeholder.com/30'; // fallback if name is undefined
  }
  // Normalize input name and convert to lowercase.
  const normalized = playerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lowered = normalized.toLowerCase();

  // Fuzzy match against player_ids keys.
  const entry = Object.entries(playerIds).find(([name, id]) => {
    const normKey = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normKey === lowered;
  });

  if (entry) {
    const id = entry[1];
    return `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
  }

  // Fallback to Showstone URL.
  const urlName = normalized.replace(/\s+/g, '-').toLowerCase();
  return `https://showstone.io/players/${urlName}.png`;
}
