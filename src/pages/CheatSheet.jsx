import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerPhotoUrl, teamSlugMap } from '../utils';
import playerIds from '../player_ids.json';

// Helper to normalize name
const normalizeName = (name) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function CheatSheet() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState('overUnderCount10'); // Default sort by L10
  const [sortDirection, setSortDirection] = useState('desc'); // Default to descending
  const last15GamesCache = useRef({});
  const [headToHeadMap, setHeadToHeadMap] = useState({});
  // Multi-select filters
  const [teamFilter, setTeamFilter] = useState([]);
  const [playerFilter, setPlayerFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState([]);

  // Helper: return team logo URL
  const getTeamLogo = (abbr) => {
    const slug = teamSlugMap[abbr];
    return slug
      ? `https://showstone.io/team_logos/${slug}.png`
      : 'https://via.placeholder.com/50';
  };

  // Handler to add a bet for a player.
  const handleAddBet = (player, betType) => {
    const savedBets = JSON.parse(localStorage.getItem('myBets')) || [];
    const newBet = {
      id: player.id,
      name: player.player_name,
      betType,
      threshold: player.threshold,
      feature: player.feature,
      timestamp: new Date().toISOString()
    };
    const updatedBets = [...savedBets, newBet];
    localStorage.setItem('myBets', JSON.stringify(updatedBets));
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (key) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  // Load cheat sheet data.
  useEffect(() => {
    async function load() {
      try {
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
          'https://showstone.io/api/cheat-sheet/?format=json'
        )}`;
        const res = await fetch(url);
        const text = await res.text();
        if (text.trim().startsWith('<!DOCTYPE')) {
          throw new Error('Received HTML instead of JSON');
        }
        const jsonRaw = JSON.parse(text);
        const cheatData = JSON.parse(jsonRaw.contents);
        setData(cheatData);
      } catch (e) {
        console.error('Error fetching data:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch Last 15 games for each unique player using the new proxy.
  useEffect(() => {
    async function loadLast15ForPage() {
      // Get unique effectiveIds
      const uniquePlayers = {};
      data.forEach((player) => {
        const matchingEntry = Object.entries(playerIds).find(
          ([name, id]) =>
            normalizeName(name).toLowerCase() ===
            normalizeName(player.player_name).toLowerCase()
        );
        const effectiveId = matchingEntry ? matchingEntry[1] : player.id;
        if (!uniquePlayers[effectiveId]) {
          uniquePlayers[effectiveId] = player;
        }
      });

      const newHeadToHeadMap = {};
      await Promise.all(
        Object.entries(uniquePlayers).map(async ([effectiveId, player]) => {
          let last15Games = last15GamesCache.current[effectiveId];
          if (!last15Games) {
            const urlLast15 = `https://showstone.io/api/players/filter_by_player/?format=json&metrics=ftm&metrics=fta&metrics=fg2m&metrics=fg3m&metrics=fg3a&metrics=fgm&metrics=fga&metrics=fg2a&metrics=game_date&metrics=opponent&metrics=min&metrics=ast&metrics=reb&metrics=blk&metrics=stl&metrics=home_or_away&metrics=pts&metrics=plus_minus&player_id=${effectiveId}&x=15`;
            const proxyUrl = `https://cloudflare-cors-anywhere.ericecchan6.workers.dev/?${encodeURIComponent(urlLast15)}`;
            try {
              const resLast15 = await fetch(proxyUrl);
              const textLast15 = await resLast15.text();
              if (textLast15.trim().startsWith('<!DOCTYPE')) {
                throw new Error('Error fetching last15');
              }
              last15Games = JSON.parse(textLast15);
              if (!Array.isArray(last15Games)) throw new Error('Not an array');
              last15GamesCache.current[effectiveId] = last15Games; // Cache it!
            } catch (error) {
              console.error("Error fetching last15 for", player.player_name, error);
              newHeadToHeadMap[effectiveId] = null;
              return;
            }
          }
          // Head-to-head last 3 (filter by opponent)
          const opp = player.opponent;
          const h2hGames = last15GamesCache.current[effectiveId]
            ? last15GamesCache.current[effectiveId].filter(g => g.opponent === opp).slice(0, 3)
            : [];
          // Use the feature and threshold from the first occurrence (for H2H)
          const key = player.feature;
          const thresholdVal = parseFloat(player.threshold);
          const calcOverUnder = (games) => {
            let overCount = 0;
            games.forEach((game) => {
              let statVal;
              switch (key) {
                case "pts_ast":
                  statVal = parseFloat(game["pts"] || 0) + parseFloat(game["ast"] || 0);
                  break;
                case "pts_reb":
                  statVal = parseFloat(game["pts"] || 0) + parseFloat(game["reb"] || 0);
                  break;
                case "ast_reb":
                  statVal = parseFloat(game["ast"] || 0) + parseFloat(game["reb"] || 0);
                  break;
                case "pts_ast_reb":
                  statVal =
                    parseFloat(game["pts"] || 0) +
                    parseFloat(game["ast"] || 0) +
                    parseFloat(game["reb"] || 0);
                  break;
                default:
                  statVal = parseFloat(game[key]);
              }
              if (!isNaN(statVal) && statVal >= thresholdVal) overCount++;
            });
            return { over: overCount, under: games.length - overCount };
          };
          newHeadToHeadMap[effectiveId] = calcOverUnder(h2hGames);
        })
      );
      setHeadToHeadMap((prev) => ({ ...prev, ...newHeadToHeadMap }));
    }

    if (data.length > 0) {
      loadLast15ForPage();
    }
  }, [data]);

  // Merge last15 data into table data.
  const tableData = data.map((player) => {
    const matchingEntry = Object.entries(playerIds).find(
      ([name, id]) =>
        normalizeName(name).toLowerCase() ===
        normalizeName(player.player_name).toLowerCase()
    );
    const effectiveId = matchingEntry ? matchingEntry[1] : player.id;
    const last15Games = last15GamesCache.current[effectiveId];

    // Calculate over/under for L15, L10, L5, H2H using last15Games
    const key = player.feature;
    const thresholdVal = parseFloat(player.threshold);

    const calcOverUnder = (games) => {
      let overCount = 0;
      games.forEach((game) => {
        let statVal;
        switch (key) {
          case "pts_ast":
            statVal = parseFloat(game["pts"] || 0) + parseFloat(game["ast"] || 0);
            break;
          case "pts_reb":
            statVal = parseFloat(game["pts"] || 0) + parseFloat(game["reb"] || 0);
            break;
          case "ast_reb":
            statVal = parseFloat(game["ast"] || 0) + parseFloat(game["reb"] || 0);
            break;
          case "pts_ast_reb":
            statVal =
              parseFloat(game["pts"] || 0) +
              parseFloat(game["ast"] || 0) +
              parseFloat(game["reb"] || 0);
            break;
          default:
            statVal = parseFloat(game[key]);
        }
        if (!isNaN(statVal) && statVal >= thresholdVal) overCount++;
      });
      return { over: overCount, under: games.length - overCount };
    };

    const overUnderCount = last15Games ? calcOverUnder(last15Games.slice(0, 15)) : null;
    const overUnderCount5 = last15Games ? calcOverUnder(last15Games.slice(0, 5)) : null;
    const overUnderCount10 = last15Games ? calcOverUnder(last15Games.slice(0, 10)) : null;
    const overUnderCountH2H = headToHeadMap[effectiveId];

    return {
      ...player,
      overUnderCount,
      overUnderCount5,
      overUnderCount10,
      overUnderCountH2H,
    };
  });

  // Multi-select filter logic
  const filteredTableData = tableData.filter(p =>
    (teamFilter.length === 0 || teamFilter.includes(p.team_abbreviation)) &&
    (!playerFilter || p.player_name === playerFilter) &&
    (featureFilter.length === 0 || featureFilter.includes(p.feature))
  );

  const sortedTableData = [...filteredTableData].sort((a, b) => {
    if (!sortKey) return 0;
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    // Special handling for over/under columns
    if (
      sortKey === 'overUnderCount' ||
      sortKey === 'overUnderCount5' ||
      sortKey === 'overUnderCount10' ||
      sortKey === 'overUnderCountH2H'
    ) {
      aVal = a[sortKey] ? a[sortKey].over : -1;
      bVal = b[sortKey] ? b[sortKey].over : -1;
    }

    // For strings, case-insensitive compare
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  // Helper for colored cell
  const renderOverUnderCell = (countObj, total) => {
    if (!countObj) return 'N/A';
    const isOver = countObj.over > countObj.under;
    return (
      <span
        style={{
          backgroundColor: isOver ? 'green' : 'red',
          color: 'white',
          padding: '2px 4px',
          borderRadius: '4px'
        }}
      >
        {countObj.over}/{total}
      </span>
    );
  };

  // Custom CSS for the filter bar and checkboxes
  const filterBarStyle = {
    marginBottom: 20,
    display: 'flex',
    gap: 24,
    alignItems: 'center',
    background: '#222c36',
    padding: '12px 20px',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    flexWrap: 'wrap'
  };
  const checkboxGroupStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    background: '#1a202c',
    borderRadius: 6,
    padding: '6px 10px',
    minHeight: 38,
  };
  const labelStyle = {
    color: '#b0b8c1',
    fontWeight: 500,
    marginRight: 6,
    fontSize: 15,
  };
  const checkboxLabelStyle = {
    color: '#fff',
    fontWeight: 400,
    fontSize: 14,
    marginRight: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer'
  };

  // Helper for checkbox filter
  const handleCheckboxFilter = (value, filter, setFilter) => {
    if (filter.includes(value)) {
      setFilter(filter.filter((v) => v !== value));
    } else {
      setFilter([...filter, value]);
    }
  };

  return (
    <div className="container">
      <h2>NBA Cheat Sheet ({sortedTableData.length})</h2>
      <div style={filterBarStyle}>
        <div>
          <span style={labelStyle}>Teams:</span>
          <span style={checkboxGroupStyle}>
            {[...new Set(data.map(p => p.team_abbreviation))].sort().map(team => (
              <label key={team} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={teamFilter.includes(team)}
                  onChange={() => handleCheckboxFilter(team, teamFilter, setTeamFilter)}
                  style={{ accentColor: '#38bdf8' }}
                />
                {team}
              </label>
            ))}
          </span>
        </div>
        <div>
          <span style={labelStyle}>Player:</span>
          <select
            value={playerFilter}
            onChange={e => setPlayerFilter(e.target.value)}
            style={{
              minWidth: 140,
              background: '#1a202c',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 15,
              outline: 'none',
            }}
          >
            <option value="">All Players</option>
            {[...new Set(data.map(p => p.player_name))].sort().map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Features:</span>
          <span style={checkboxGroupStyle}>
            {[...new Set(data.map(p => p.feature))].sort().map(feature => (
              <label key={feature} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={featureFilter.includes(feature)}
                  onChange={() => handleCheckboxFilter(feature, featureFilter, setFeatureFilter)}
                  style={{ accentColor: '#38bdf8' }}
                />
                {feature}
              </label>
            ))}
          </span>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr style={{ height: '30px' }}>
            <th>Photo</th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('player_name')}>
              Player{renderSortIndicator('player_name')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('team_abbreviation')}>
              Team{renderSortIndicator('team_abbreviation')}
            </th>
            <th>Opponent</th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('threshold')}>
              Prop{renderSortIndicator('threshold')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('feature')}>
              Feature{renderSortIndicator('feature')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('overUnderCount5')}>
              Last 5{renderSortIndicator('overUnderCount5')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('overUnderCount10')}>
              Last 10{renderSortIndicator('overUnderCount10')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('overUnderCount')}>
              Last 15{renderSortIndicator('overUnderCount')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('overUnderCountH2H')}>
              H2H (3){renderSortIndicator('overUnderCountH2H')}
            </th>
            <th>Bet</th>
          </tr>
        </thead>
        <tbody>
          {sortedTableData.map((p) => (
            <tr
              key={p.id + '-' + p.feature + '-' + p.threshold}
              className="clickable"
              onClick={() =>
                navigate(`/player/${p.id}`, { state: { player: p } })
              }
              style={{ cursor: 'pointer', height: '30px' }}
            >
              <td>
                <img
                  src={getPlayerPhotoUrl(normalizeName(p.player_name))}
                  alt={p.player_name}
                  width={30}
                />
              </td>
              <td>{p.player_name}</td>
              <td>
                <img
                  src={getTeamLogo(p.team_abbreviation)}
                  alt={p.team_abbreviation}
                  width={30}
                />
              </td>
              <td>
                <img
                  src={getTeamLogo(p.opponent)}
                  alt={p.opponent}
                  width={30}
                />
              </td>
              <td>{p.threshold}</td>
              <td>{p.feature}</td>
              <td>
                {p.overUnderCount5
                  ? renderOverUnderCell(p.overUnderCount5, 5)
                  : 'N/A'}
              </td>
              <td>
                {p.overUnderCount10
                  ? renderOverUnderCell(p.overUnderCount10, 10)
                  : 'N/A'}
              </td>
              <td>
                {p.overUnderCount
                  ? renderOverUnderCell(p.overUnderCount, 15)
                  : 'N/A'}
              </td>
              <td>
                {p.overUnderCountH2H
                  ? renderOverUnderCell(p.overUnderCountH2H, 3)
                  : 'N/A'}
              </td>
              <td>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddBet(p, 'Over');
                  }}
                >
                  Over
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddBet(p, 'Under');
                  }}
                  style={{ marginLeft: 4 }}
                >
                  Under
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}