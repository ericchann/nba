import nbaPlayers from './nba_players.json';
import wnbaPlayers from './wnba_players.json';
import allPlayers from './all_players.json';

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

export const wnbaTeamSlugMap = {
  ATL: 'atl', // Atlanta Dream
  CHI: 'chi', // Chicago Sky
  CON: 'con', // Connecticut Sun
  IND: 'ind', // Indiana Fever
  NYL: 'ny', // New York Liberty
  WAS: 'was', // Washington Mystics
  DAL: 'dal', // Dallas Wings
  GSV: 'gsv', // Golden State Valkyries
  LVA: 'lva', // Las Vegas Aces
  LAS: 'las', // Los Angeles Sparks
  MIN: 'min', // Minnesota Lynx
  PHX: 'phx', // Phoenix Mercury
  SEA: 'sea', // Seattle Storm
};

// Simple normalization for fuzzy matching
function normalize(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Get player ID by exact full name (case-insensitive)
export function getPlayerIdByName(name) {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  const player = allPlayers.find(
    p => p.full_name && p.full_name.trim().toLowerCase() === lower
  );
  return player ? player.id : null;
}

// Get player object by exact full name (case-insensitive)
export function getPlayerByName(name) {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return allPlayers.find(
    p => p.full_name && p.full_name.trim().toLowerCase() === lower
  );
}

// Get player object by ID
export function getPlayerById(id) {
  return allPlayers.find(p => String(p.id) === String(id));
}

// Fuzzy match: get player object by approximate name
export function fuzzyFindPlayerByName(name) {
  if (!name) return null;
  const norm = normalize(name);

  // Try exact normalized match first
  let player = allPlayers.find(
    p => p.full_name && normalize(p.full_name) === norm
  );
  if (player) return player;

  // Try partial match (name is substring)
  player = allPlayers.find(
    p => p.full_name && normalize(p.full_name).includes(norm)
  );
  if (player) return player;

  // Try first+last name split
  const [first, ...rest] = norm.split(' ');
  if (rest.length) {
    player = allPlayers.find(
      p =>
        p.first_name &&
        p.last_name &&
        normalize(p.first_name).startsWith(first) &&
        normalize(p.last_name).startsWith(rest.join(''))
    );
    if (player) return player;
  }

  // No match found
  return null;
}

// Get player photo URL (NBA and WNBA) using all_players.json info
export function getPlayerPhotoUrl(name) {
  // Try WNBA first
  let player = wnbaPlayers.find(
    p => p.full_name && p.full_name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (!player) {
    // Try fuzzy in WNBA
    player = wnbaPlayers.find(
      p => p.full_name && p.full_name.toLowerCase().includes(name.trim().toLowerCase())
    );
  }
  if (player) {
    // WNBA headshots use player ID
    return `https://cdn.wnba.com/headshots/wnba/latest/1040x760/${player.id}.png`;
  }

  // Try NBA
  player = nbaPlayers.find(
    p => p.full_name && p.full_name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (!player) {
    // Try fuzzy in NBA
    player = nbaPlayers.find(
      p => p.full_name && p.full_name.toLowerCase().includes(name.trim().toLowerCase())
    );
  }
  if (player) {
    return `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.id}.png`;
  }

  // fallback
  return 'https://via.placeholder.com/50';
}