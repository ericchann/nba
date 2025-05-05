import playerIdMap from './player_ids.json';

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


export function getPlayerPhotoUrl(fullName) {
  const id = playerIdMap[fullName];
  return id
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
    : 'https://via.placeholder.com/40';
}
