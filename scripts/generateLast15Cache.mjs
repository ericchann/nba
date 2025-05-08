import fetch from 'node-fetch';
import { readFile, writeFile } from 'fs/promises';

// Read and parse player_ids.json without using import assertions.
const playerIdsData = await readFile(new URL('../src/player_ids.json', import.meta.url), 'utf8');
const playerIds = JSON.parse(playerIdsData);

// Helper to normalize names (remove accents)
const normalizeName = (name) => {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Configuration
const CHEATSHEET_URL = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://showstone.io/api/cheat-sheet/?format=json');
const LAST15_BASE_URL = 'https://showstone.io/api/players/filter_by_player/?format=json'
  + '&metrics=ftm&metrics=fta&metrics=fg2m&metrics=fg3m&metrics=fg3a'
  + '&metrics=fgm&metrics=fga&metrics=fg2a&metrics=game_date&metrics=opponent'
  + '&metrics=min&metrics=ast&metrics=reb&metrics=blk&metrics=stl'
  + '&metrics=home_or_away&metrics=pts&metrics=plus_minus';
const X_GAMES = 15;  // we are fetching 15 games

// Maximum attempts per API call
const MAX_ATTEMPTS = 5;
const RETRY_DELAY = 2000; // in ms

// Utility delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to fetch last15 data with retry mechanism
async function fetchLast15Data(effectiveId, playerFeature, playerThreshold, attempt = 1) {
  const urlLast15 = `${LAST15_BASE_URL}&player_id=${effectiveId}&x=${X_GAMES}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlLast15)}`;
  try {
    const res = await fetch(proxyUrl);
    // AllOrigins returns status 200 if the proxy call succeeded.
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
    const text = await res.text();
    if (text.trim().startsWith('<!DOCTYPE')) {
      throw new Error('Response appears to be HTML instead of JSON.');
    }
    const jsonRaw = JSON.parse(text);
    console.log('AllOrigins status:', jsonRaw.status);
    const last15Games = JSON.parse(jsonRaw.contents);
    // Calculate over count:
    const key = playerFeature;
    const thresholdVal = parseFloat(playerThreshold);
    let overCount = 0;
    last15Games.forEach((game) => {
      const statVal = parseFloat(game[key]);
      if (!isNaN(statVal) && statVal > thresholdVal) {
        overCount++;
      }
    });
    return { over: overCount, under: X_GAMES - overCount, last15Games };
  } catch (error) {
    console.error(`Error fetching last15 for effectiveId ${effectiveId} (attempt ${attempt}):`, error.message);
    if (attempt < MAX_ATTEMPTS) {
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await delay(RETRY_DELAY);
      return fetchLast15Data(effectiveId, playerFeature, playerThreshold, attempt + 1);
    } else {
      console.error(`Max attempts reached for effectiveId ${effectiveId}.`);
      return null;
    }
  }
}

// Main function to generate the cache file.
async function generateCache() {
  try {
    // First, fetch cheat sheet data.
    const resCheat = await fetch(CHEATSHEET_URL);
    if (!resCheat.ok) {
      throw new Error(`Cheat sheet fetch error: HTTP ${resCheat.status}`);
    }
    const cheatText = await resCheat.text();
    const jsonCheatRaw = JSON.parse(cheatText);
    const cheatData = JSON.parse(jsonCheatRaw.contents);

    // Use a Map to avoid duplicates. Keyed by effectiveId.
    const cache = new Map();

    // For each player in the cheat sheet...
    for (const player of cheatData) {
      // Determine the effectiveId using playerIds.
      const matchingEntry = Object.entries(playerIds).find(
        ([name, id]) =>
          normalizeName(name).toLowerCase() === normalizeName(player.player_name).toLowerCase()
      );
      const effectiveId = matchingEntry ? matchingEntry[1] : player.id;
      
      // If we've already processed this id, skip it.
      if (cache.has(effectiveId)) continue;

      // Perform last15 fetch and calculation.
      const result = await fetchLast15Data(effectiveId, player.feature, player.threshold);
      // Store an entry if successful.
      if (result) {
        cache.set(effectiveId, {
          player_name: player.player_name,
          effectiveId,
          overUnderCount: result,    // contains over, under, and the raw last 15 games data.
        });
      }
    }

    // Convert cache Map to an object.
    const cacheObj = Object.fromEntries(cache);
    // Write the cache JSON file.
    await writeFile('last15Cache.json', JSON.stringify(cacheObj, null, 2));
    console.log('Cache written to last15Cache.json successfully.');
  } catch (error) {
    console.error('Failed to generate cache:', error);
  }
}

// Run the cache generation script.
generateCache();