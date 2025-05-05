// src/pages/MyBets.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { getPlayerPhotoUrl, teamSlugMap } from '../utils';
import playerIdMap from '../player_ids.json';

// map feature codes to boxscore keys
const statMap = { pts: 'points', ast: 'assists', reb: 'reboundsTotal' };

export default function MyBets({
  activeBets,
  pastBets,
  onRemoveActive,
  onRemovePast,
  onArchive,
}) {
  const [liveStatus, setLiveStatus] = useState({});

  // Sum up stats for multi-part features
  const getLiveStat = useCallback((stats, feature) => {
    return feature
      .split(/[_ ,]+/)
      .map((p) => statMap[p.toLowerCase()])
      .reduce((sum, key) => sum + (stats[key] || 0), 0);
  }, []);

  // Fetch live statuses for active bets
  useEffect(() => {
    if (activeBets.length === 0) return;
    const proxy = 'https://thingproxy.freeboard.io/fetch/';

    const fetchLive = async () => {
      try {
        // 1) Today's scoreboard
        const sbRes  = await fetch(
          proxy +
            'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json'
        );
        const sbJson = await sbRes.json();
        const games  = sbJson.scoreboard.games || [];

        // 2) For each active bet, fetch its boxscore
        const updates = await Promise.all(
          activeBets.map(async (bet) => {
            const gMeta = games.find(
              (g) =>
                g.homeTeam.teamTricode === bet.team_abbreviation ||
                g.awayTeam.teamTricode === bet.team_abbreviation
            );
            if (!gMeta) return [bet.id, 'Game Not Found'];

            const boxRes  = await fetch(
              proxy +
                `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gMeta.gameId}.json`
            );
            const boxJson = await boxRes.json();
            const g       = boxJson.game;

            // NBA's own status text
            let status = g.gameStatus === 1
              ? 'Game Not Started'
              : g.gameStatusText;

            // Append live stat if started or final
            const allPlayers = [...g.homeTeam.players, ...g.awayTeam.players];
            const pid  = playerIdMap[bet.player_name];
            const pl   = allPlayers.find((p) => p.personId === pid);
            if (pl && pl.statistics && status !== 'Game Not Started') {
              const val = getLiveStat(pl.statistics, bet.feature);
              status += ` | ${val}`;
            }

            return [bet.id, status];
          })
        );

        setLiveStatus(Object.fromEntries(updates));
      } catch (err) {
        console.error('Live fetch error', err);
      }
    };

    fetchLive();
    const iv = setInterval(fetchLive, 30000);
    return () => clearInterval(iv);
  }, [activeBets, getLiveStat]);

  // Archive any bet that just went Final
  useEffect(() => {
    activeBets.forEach((bet) => {
      const status = liveStatus[bet.id] || '';
      if (status.startsWith('Final')) {
        const parts = status.split('|').map((s) => s.trim());
        const finalVal = parts[1] ? parseFloat(parts[1]) : NaN;
        onArchive(bet, finalVal);
      }
    });
  }, [liveStatus, activeBets, onArchive]);

  // Calculate wins and losses for past bets
  const wins = pastBets.filter(b => b.result === 'Win').length;
  const losses = pastBets.filter(b => b.result !== 'Win').length;

  if (activeBets.length === 0 && pastBets.length === 0) {
    return <p>You have no bets yet.</p>;
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2>My Bets</h2>

        {/* Active Bets */}
        <h3>Active Bets</h3>
        {activeBets.length === 0 ? (
          <p>No active bets</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th>Opponent</th>
                <th>Bet</th>
                <th>Live Status</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {activeBets.map((b) => (
                <tr key={b.id}>
                  <td style={{ padding: '8px' }}>
                    <img
                      src={getPlayerPhotoUrl(b.player_name)}
                      alt=""
                      className="photo"
                    />{' '}
                    {b.player_name}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <img
                      src={
                        teamSlugMap[b.team_abbreviation]
                          ? `https://showstone.io/team_logos/${teamSlugMap[b.team_abbreviation]}.png`
                          : 'https://via.placeholder.com/50'
                      }
                      width={50}
                      height={50}
                      alt=""
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <img
                      src={
                        teamSlugMap[b.opponent]
                          ? `https://showstone.io/team_logos/${teamSlugMap[b.opponent]}.png`
                          : 'https://via.placeholder.com/50'
                      }
                      width={50}
                      height={50}
                      alt=""
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <strong>{b.betType}</strong> {b.threshold} {b.feature}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {liveStatus[b.id] || 'Loading…'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <button onClick={() => onRemoveActive(b.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Past Bets */}
        <h3>Past Bets (Record: {wins}-{losses})</h3>
        {pastBets.length === 0 ? (
          <p>No past bets</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ fontSize: '0.9rem' }}>Date Placed</th>
                <th>Player</th>
                <th>Team</th>
                <th>Opponent</th>
                <th>Bet</th>
                <th>Result</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {pastBets.map((b) => (
                <tr
                  key={b.id}
                  className={b.result === 'Win' ? 'win-row' : 'loss-row'}
                  style={{ fontSize: '0.8rem', height: '40px' }}
                >
                  <td style={{ padding: '4px 8px' }}>
                    {b.datePlaced
                      ? new Date(b.datePlaced).toLocaleString()
                      : '—'}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <img
                      src={getPlayerPhotoUrl(b.player_name)}
                      alt=""
                      className="photo"
                      style={{ width: 24, height: 24, marginRight: 8 }}
                    />
                    {b.player_name}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <img
                      src={
                        teamSlugMap[b.team_abbreviation]
                          ? `https://showstone.io/team_logos/${teamSlugMap[b.team_abbreviation]}.png`
                          : 'https://via.placeholder.com/50'
                      }
                      width={32}
                      height={32}
                      alt=""
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <img
                      src={
                        teamSlugMap[b.opponent]
                          ? `https://showstone.io/team_logos/${teamSlugMap[b.opponent]}.png`
                          : 'https://via.placeholder.com/50'
                      }
                      width={32}
                      height={32}
                      alt=""
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <strong>{b.betType}</strong> {b.threshold} {b.feature}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{b.result}</td>
                  <td style={{ padding: '4px 8px' }}>
                    <button onClick={() => onRemovePast(b.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
