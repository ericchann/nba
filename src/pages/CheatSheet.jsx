import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerPhotoUrl, teamSlugMap, wnbaTeamSlugMap } from '../utils';

// Helper to normalize name
const normalizeName = (name) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function CheatSheet({
  data,
  setData,
  headToHeadMap,
  setHeadToHeadMap,
  // ...other props...
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState('overUnderCount10'); // Default sort by L10
  const [sortDirection, setSortDirection] = useState('desc'); // Default to descending
  // Multi-select filters
  const [teamFilter, setTeamFilter] = useState([]);
  const [playerFilter, setPlayerFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState([]);

  // Helper: return team logo URL
  const getTeamLogo = (abbr, player) => {
    // Use player.league to determine league
    if (player.league === 'WNBA' && wnbaTeamSlugMap[abbr]) {
      return `https://showstone.io/wnba_team_logos/${wnbaTeamSlugMap[abbr]}.png`;
    }
    if (teamSlugMap[abbr]) {
      return `https://showstone.io/team_logos/${teamSlugMap[abbr]}.png`;
    }
    return 'https://via.placeholder.com/50';
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
        // Use your Cloudflare CORS Anywhere proxy instead of allorigins
        const apiUrl = 'https://showstone.io/api/cheat-sheet/?format=json';
        const proxyUrl = `https://cloudflare-cors-anywhere.ericecchan6.workers.dev/?${encodeURIComponent(apiUrl)}`;
        const res = await fetch(proxyUrl);
        const text = await res.text();
        if (text.trim().startsWith('<!DOCTYPE')) {
          throw new Error('Received HTML instead of JSON');
        }
        // The proxy returns the raw JSON, so no need to parse .contents
        const cheatData = JSON.parse(text);
        setData(cheatData);
      } catch (e) {
        console.error('Error fetching data:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setData]);

  // Helper for over/under calculation
  const calcOverUnderArr = (arr, threshold) => {
    let over = 0;
    arr.forEach(val => {
      if (val == null || isNaN(val)) return;
      if (Number(val) > Number(threshold)) over++;
    });
    return { over, under: arr.length - over };
  };

  // Merge last15 data into table data.
  const tableData = data.map((player) => {
    const l15Arr = Array.isArray(player.l15) ? player.l15.map(Number) : [];
    const l10Arr = l15Arr.slice(-10);
    const l5Arr = l15Arr.slice(-5);
    const h2hArr = Array.isArray(player.last3_vs_opponent) ? player.last3_vs_opponent.map(Number) : [];
    const threshold = Number(player.threshold);

    return {
      ...player,
      overUnderCount15: calcOverUnderArr(l15Arr, threshold),
      overUnderCount10: calcOverUnderArr(l10Arr, threshold),
      overUnderCount5: calcOverUnderArr(l5Arr, threshold),
      overUnderCountH2H: calcOverUnderArr(h2hArr, threshold),
      l15Length: l15Arr.length,
      l10Length: l10Arr.length,
      l5Length: l5Arr.length,
      h2hLength: h2hArr.length,
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

    // Special handling for over/under columns: sort by numerator (the higher of over/under)
    if (
      sortKey === 'overUnderCount' ||
      sortKey === 'overUnderCount5' ||
      sortKey === 'overUnderCount10' ||
      sortKey === 'overUnderCountH2H'
    ) {
      aVal = a[sortKey] ? Math.max(a[sortKey].over, a[sortKey].under) : -1;
      bVal = b[sortKey] ? Math.max(b[sortKey].over, b[sortKey].under) : -1;
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

  // Helper for colored cell with correct logic for L5, L10, L15, H2H
  const renderOverUnderCell = (countObj, total) => {
    if (!countObj) return 'N/A';
    const { over, under } = countObj;
    let color = 'green';
    let main = over;
  
    // H2H (3): never yellow
    if (total === 3) {
      if (over > under) {
        color = 'green';
        main = over;
      } else {
        color = 'red';
        main = under;
      }
    } else {
      // L10: 5/10 is yellow
      if (total === 10 && over === 5 && under === 5) {
        color = 'yellow';
        main = 5;
      }
      // L5/L15: tie is yellow
      else if ((total === 5 || total === 15) && over === under) {
        color = 'yellow';
        main = over;
      }
      // Otherwise, green for more overs, red for more unders
      else if (over > under) {
        color = 'green';
        main = over;
      } else if (under > over) {
        color = 'red';
        main = under;
      }
    }
  
    // Always show at least half (rounded up)
    main = Math.max(main, Math.ceil(total / 2));
    return (
      <span
        style={{
          backgroundColor: color,
          color: color === 'yellow' ? '#222' : 'white',
          padding: '2px 4px',
          borderRadius: '4px',
          fontWeight: 600,
        }}
      >
        {main}/{total}
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
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('overUnderCount15')}>
              Last 15{renderSortIndicator('overUnderCount15')}
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
                  src={getTeamLogo(p.team_abbreviation, p)}
                  alt={p.team_abbreviation}
                  width={30}
                />
              </td>
              <td>
                <img
                  src={getTeamLogo(p.opponent, p)}
                  alt={p.opponent}
                  width={30}
                />
              </td>
              <td>{p.threshold}</td>
              <td>{p.feature}</td>
              <td>
                {p.overUnderCount5
                  ? renderOverUnderCell(p.overUnderCount5, p.l5Length)
                  : 'N/A'}
              </td>
              <td>
                {p.overUnderCount10
                  ? renderOverUnderCell(p.overUnderCount10, p.l10Length)
                  : 'N/A'}
              </td>
              <td>
                {p.overUnderCount15
                  ? renderOverUnderCell(p.overUnderCount15, p.l15Length)
                  : 'N/A'}
              </td>
              <td>
                {p.overUnderCountH2H
                  ? renderOverUnderCell(p.overUnderCountH2H, p.h2hLength)
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