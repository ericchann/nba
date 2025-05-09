import React, { useState, useEffect, useRef } from 'react';
import { teamSlugMap } from '../utils';

// Helper to format today's date as YYYY-MM-DD
const getToday = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const API_KEY = "CHi8Hy5CEE4khd46XNYL23dCFX96oUdw6qOt1Dnh";

const getTeamLogo = (abbr) => {
  const slug = teamSlugMap[abbr];
  return slug
    ? `https://showstone.io/team_logos/${slug}.png`
    : 'https://via.placeholder.com/50';
};

// Helper: get feature label from market_id
const getFeature = (market_id) => {
  const map = {
    151: 'assists',
    152: 'blocks',
    156: 'points',
    157: 'rebounds',
    160: 'steals',
    162: 'turnovers',
    335: 'pts+ast',
    336: 'pts+reb',
    337: 'ast+reb',
    338: 'pts+ast+reb',
  };
  return map[market_id] || market_id;
};

export default function CheatSheet2() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [propsData, setPropsData] = useState([]);
  const [playerMeta, setPlayerMeta] = useState({});
  const [teamEvents, setTeamEvents] = useState({});
  const [playerH2H, setPlayerH2H] = useState({});
  const [playerStats, setPlayerStats] = useState({});
  const [finalPerformance, setFinalPerformance] = useState({});
  const [sortKey, setSortKey] = useState('performance_last_10');
  const [sortDirection, setSortDirection] = useState('desc');
  const [teamFilter, setTeamFilter] = useState([]);
  const [playerFilter, setPlayerFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState([]);

  // Caches
  const metaCache = useRef({});
  const eventsCache = useRef({});
  const h2hCache = useRef({});
  const statsCache = useRef({});

  // 1. Fetch main props data
  useEffect(() => {
    async function fetchProps() {
      setLoading(true);
      setError(null);
      try {
        const today = getToday();
        const url = `https://api.bettingpros.com/v3/props?limit=100&page=1&sport=NBA&market_id=156:157:151:162:160:152:335:336:337:338&date=${today}&location=MA&book_id=37&sort=diff&sort_direction=desc&performance_type_sort=last_15&include_correlated_picks=true&correlated_picks_limit=1&include_selections=false&include_markets=true&min_odds=-1000&max_odds=1000&ev_threshold_min=-0.4&ev_threshold_max=0.4&performance_type_filter=last_15`;
        const res = await fetch(url, {
          headers: { "x-api-key": API_KEY },
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setPropsData(data.props || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProps();
  }, []);

  // 2. Fetch player meta (id, slug, team) for all unique player names
  useEffect(() => {
    if (!propsData.length) return;
    const fetchMeta = async () => {
      const url = `https://api.bettingpros.com/v3/markets/offer-counts?sport=NBA&season=2024&market_category=player-futures&location=MA`;
      const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
      const data = await res.json();
      const meta = {};
      for (const detail of data.details) {
        for (const p of detail.participants) {
          meta[p.name] = {
            player_id: p.id,
            slug: p.player.slug,
            team: p.player.team,
            position: p.player.position,
          };
        }
      }
      metaCache.current = meta;
      setPlayerMeta(meta);
    };
    fetchMeta();
  }, [propsData]);

  // 3. Fetch team events for all unique teams (cache by team)
  useEffect(() => {
    if (!propsData.length || !Object.keys(playerMeta).length) return;
    const teams = Array.from(new Set(propsData.map(p => {
      const meta = playerMeta[p.participant.name];
      return meta ? meta.team : null;
    }).filter(Boolean)));
    const fetchEvents = async () => {
      const newEvents = {};
      for (const team of teams) {
        if (eventsCache.current[team]) {
          newEvents[team] = eventsCache.current[team];
          continue;
        }
        // Use points (156) as default market_id for event list
        const url = `https://api.bettingpros.com/v3/props/compare?sport=NBA&market_id=156&team_id=${team}&season=2024&limit=16&include_no_line_events=true`;
        const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
        const data = await res.json();
        const eventIds = (data.events || []).map(e => e.event.id);
        eventsCache.current[team] = eventIds;
        newEvents[team] = eventIds;
      }
      setTeamEvents(prev => ({ ...prev, ...newEvents }));
    };
    fetchEvents();
  }, [propsData, playerMeta]);

  // 4. Fetch H2H event IDs for each player/team (cache by player+team)
  useEffect(() => {
    if (!propsData.length || !Object.keys(playerMeta).length) return;
    const fetchH2H = async () => {
      const newH2H = {};
      for (const p of propsData) {
        const meta = playerMeta[p.participant.name];
        if (!meta) continue;
        const key = `${meta.player_id}_${meta.team}`;
        if (h2hCache.current[key]) {
          newH2H[key] = h2hCache.current[key];
          continue;
        }
        const url = `https://api.bettingpros.com/v3/props/analysis?include_no_line_events=true&player_id=${meta.player_id}&market_id=156&location=ALL&sort=desc&sport=NBA&limit=3&filter_head_to_head=${meta.team}`;
        const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
        const data = await res.json();
        const eventIds = (data.analyses || []).map(a => a.event.id);
        h2hCache.current[key] = eventIds;
        newH2H[key] = eventIds;
      }
      setPlayerH2H(prev => ({ ...prev, ...newH2H }));
    };
    fetchH2H();
  }, [propsData, playerMeta]);

  // 5. Fetch player stats for all event IDs (cache by event_id)
  useEffect(() => {
    if (!propsData.length || !Object.keys(playerMeta).length || !Object.keys(teamEvents).length || !Object.keys(playerH2H).length) return;
    const fetchStats = async () => {
      const allEventIds = new Set();
      for (const p of propsData) {
        const meta = playerMeta[p.participant.name];
        if (!meta) continue;
        const team = meta.team;
        const events = teamEvents[team] || [];
        const key = `${meta.player_id}_${team}`;
        const h2h = playerH2H[key] || [];
        [...events, ...h2h].forEach(id => allEventIds.add(id));
      }
      // Only fetch stats for event_ids not in cache
      const missing = Array.from(allEventIds).filter(id => !statsCache.current[id]);
      if (missing.length) {
        const chunkSize = 20;
        for (let i = 0; i < missing.length; i += chunkSize) {
          const chunk = missing.slice(i, i + chunkSize);
          const url = `https://partners.fantasypros.com/api/v1/player-game-stats.php?event_id=${chunk.join(':')}&sport=NBA`;
          const res = await fetch(url);
          const data = await res.json();
          for (const player of data.players || []) {
            statsCache.current[player.game_id] = player;
          }
        }
      }
      setPlayerStats({ ...statsCache.current });
    };
    fetchStats();
  }, [propsData, playerMeta, teamEvents, playerH2H]);

  // 6. Calculate L5, L10, L15, H2H for each row
  useEffect(() => {
    if (!propsData.length || !Object.keys(playerMeta).length || !Object.keys(teamEvents).length || !Object.keys(playerH2H).length || !Object.keys(playerStats).length) return;
    const perf = {};
    for (const p of propsData) {
      const meta = playerMeta[p.participant.name];
      if (!meta) continue;
      const team = meta.team;
      const player_id = meta.player_id;
      const events = teamEvents[team] || [];
      const key = `${player_id}_${team}`;
      const h2h = playerH2H[key] || [];
      const allEvents = events.map(id => playerStats[id]).filter(Boolean).filter(stat => stat.player_id === player_id);
      const feature = getFeature(p.market_id);
      const propLine = p.over?.line ?? p.under?.line ?? null;
      // Helper to count over/under for N games
      const countOverUnder = (arr, n) => {
        let over = 0, under = 0;
        for (let i = 0; i < Math.min(n, arr.length); i++) {
          const stat = arr[i];
          const val = Number(stat[feature]);
          if (propLine == null || isNaN(val)) continue;
          if (val > propLine) over++;
          else under++;
        }
        return { over, under };
      };
      perf[p.participant.name + '_' + p.market_id] = {
        last_5: countOverUnder(allEvents, 5),
        last_10: countOverUnder(allEvents, 10),
        last_15: countOverUnder(allEvents, 15),
        h2h: countOverUnder(h2h.map(id => playerStats[id]).filter(Boolean), 3),
        streak: 0, // You can add streak logic if needed
      };
    }
    setFinalPerformance(perf);
  }, [propsData, playerMeta, teamEvents, playerH2H, playerStats]);

  // Helper: get player photo
  const getPlayerPhoto = (player) =>
    player?.image ||
    'https://via.placeholder.com/50';

  // Helper: get team abbreviation
  const getTeam = (player) =>
    player?.team || '';

  // Helper: render over/under cell
  const renderOverUnderCell = (countObj, total) => {
    if (!countObj) return 'N/A';
    const { over = 0, under = 0 } = countObj;
    let color = 'green';
    let main = over;
    if (over > under) {
      color = 'green';
      main = over;
    } else if (under > over) {
      color = 'red';
      main = under;
    } else {
      // Tie case (e.g., 5/10), highlight yellow
      color = 'yellow';
      main = over; // or under, since they're equal
    }
    // For L10, if 5/10, highlight yellow
    if (total === 10 && over === 5 && under === 5) {
      color = 'yellow';
      main = 5;
    }
    // For L5/L15, if tie, highlight yellow
    if ((total === 5 || total === 15) && over === under) {
      color = 'yellow';
      main = over;
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

  // Helper: render projection
  const renderProjection = (projection) => {
    if (!projection) return 'N/A';
    return (
      <span>
        <b>{projection.recommended_side?.toUpperCase()}</b> {projection.value} ({projection.diff > 0 ? '+' : ''}{projection.diff})
      </span>
    );
  };

  // Helper: render opposition rank with color
  const renderOppositionRank = (extra) => {
    if (!extra?.opposition_rank) return 'N/A';
    const rank = extra.opposition_rank.rank;
    let bg = '';
    if (rank >= 1 && rank <= 10) bg = '#ef4444'; // red
    else if (rank >= 11 && rank <= 20) bg = '#38bdf8'; // blue
    else if (rank >= 21 && rank <= 30) bg = '#22c55e'; // green
    return (
      <span
        style={{
          background: bg,
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        #{rank}
      </span>
    );
  };

  // Helper: render streak
  const renderStreak = (performance) => {
    if (!performance) return 'N/A';
    return (
      <span>
        {performance.streak_type === 'over' ? 'Over' : 'Under'} {performance.streak}
      </span>
    );
  };

  // Helper: render correlated picks
  const renderCorrelatedPicks = (correlated_picks) => {
    if (!Array.isArray(correlated_picks) || correlated_picks.length === 0) return 'N/A';
    return (
      <div>
        {correlated_picks.map((pick, i) => (
          <div key={i}>
            {pick.participant?.name || 'Unknown'} {pick.line !== undefined ? `(${pick.line})` : ''}
          </div>
        ))}
      </div>
    );
  };

  // Add bet to localStorage
  const handleAddBet = (p, betType) => {
    const savedBets = JSON.parse(localStorage.getItem('myBets')) || [];
    const newBet = {
      id: p.participant.id,
      name: p.participant.name,
      betType,
      threshold: p.over?.line ?? p.under?.line ?? '',
      feature: getFeature(p.market_id),
      timestamp: new Date().toISOString()
    };
    const updatedBets = [...savedBets, newBet];
    localStorage.setItem('myBets', JSON.stringify(updatedBets));
  };

  // Filtering
  const filteredData = propsData.filter((p) =>
    (teamFilter.length === 0 || teamFilter.includes(getTeam(p.participant.player))) &&
    (!playerFilter || p.participant.name === playerFilter) &&
    (featureFilter.length === 0 || featureFilter.includes(getFeature(p.market_id)))
  );

  // Sorting
  const sortedData = [...filteredData].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'player_name':
        aVal = a.participant.name;
        bVal = b.participant.name;
        break;
      case 'team':
        aVal = getTeam(a.participant.player);
        bVal = getTeam(b.participant.player);
        break;
      case 'feature':
        aVal = getFeature(a.market_id);
        bVal = getFeature(b.market_id);
        break;
      case 'projection_diff':
        aVal = Math.abs(a.projection?.diff ?? 0);
        bVal = Math.abs(b.projection?.diff ?? 0);
        break;
      case 'opp_rank':
        aVal = a.extra?.opposition_rank?.rank ?? 100;
        bVal = b.extra?.opposition_rank?.rank ?? 100;
        break;
      case 'performance_last_5':
        aVal = finalPerformance[a.participant.name + '_' + a.market_id]?.last_5?.over > finalPerformance[a.participant.name + '_' + a.market_id]?.last_5?.under
          ? finalPerformance[a.participant.name + '_' + a.market_id]?.last_5?.over
          : finalPerformance[a.participant.name + '_' + a.market_id]?.last_5?.under;
        bVal = finalPerformance[b.participant.name + '_' + b.market_id]?.last_5?.over > finalPerformance[b.participant.name + '_' + b.market_id]?.last_5?.under
          ? finalPerformance[b.participant.name + '_' + b.market_id]?.last_5?.over
          : finalPerformance[b.participant.name + '_' + b.market_id]?.last_5?.under;
        break;
      case 'performance_last_10':
        aVal = finalPerformance[a.participant.name + '_' + a.market_id]?.last_10?.over > finalPerformance[a.participant.name + '_' + a.market_id]?.last_10?.under
          ? finalPerformance[a.participant.name + '_' + a.market_id]?.last_10?.over
          : finalPerformance[a.participant.name + '_' + a.market_id]?.last_10?.under;
        bVal = finalPerformance[b.participant.name + '_' + b.market_id]?.last_10?.over > finalPerformance[b.participant.name + '_' + b.market_id]?.last_10?.under
          ? finalPerformance[b.participant.name + '_' + b.market_id]?.last_10?.over
          : finalPerformance[b.participant.name + '_' + b.market_id]?.last_10?.under;
        break;
      case 'performance_last_15':
        aVal = finalPerformance[a.participant.name + '_' + a.market_id]?.last_15?.over > finalPerformance[a.participant.name + '_' + a.market_id]?.last_15?.under
          ? finalPerformance[a.participant.name + '_' + a.market_id]?.last_15?.over
          : finalPerformance[a.participant.name + '_' + a.market_id]?.last_15?.under;
        bVal = finalPerformance[b.participant.name + '_' + b.market_id]?.last_15?.over > finalPerformance[b.participant.name + '_' + b.market_id]?.last_15?.under
          ? finalPerformance[b.participant.name + '_' + b.market_id]?.last_15?.over
          : finalPerformance[b.participant.name + '_' + b.market_id]?.last_15?.under;
        break;
      case 'performance_h2h':
        aVal = finalPerformance[a.participant.name + '_' + a.market_id]?.h2h?.over > finalPerformance[a.participant.name + '_' + a.market_id]?.h2h?.under
          ? finalPerformance[a.participant.name + '_' + a.market_id]?.h2h?.over
          : finalPerformance[a.participant.name + '_' + a.market_id]?.h2h?.under;
        bVal = finalPerformance[b.participant.name + '_' + b.market_id]?.h2h?.over > finalPerformance[b.participant.name + '_' + b.market_id]?.h2h?.under
          ? finalPerformance[b.participant.name + '_' + b.market_id]?.h2h?.over
          : finalPerformance[b.participant.name + '_' + b.market_id]?.h2h?.under;
        break;
      case 'streak':
        aVal = finalPerformance[a.participant.name + '_' + a.market_id]?.streak ?? 0;
        bVal = finalPerformance[b.participant.name + '_' + b.market_id]?.streak ?? 0;
        break;
      default:
        aVal = 0;
        bVal = 0;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Unique teams/features/players for filters
  const uniqueTeams = Array.from(new Set(propsData.map(p => getTeam(p.participant.player)))).sort();
  const uniquePlayers = Array.from(new Set(propsData.map(p => p.participant.name))).sort();
  const uniqueFeatures = Array.from(new Set(propsData.map(p => getFeature(p.market_id)))).sort();

  // Filter bar styles (move these up if you want to use them in your filter bar)
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

  // Helper for filter checkboxes
  const handleCheckboxFilter = (value, filter, setFilter) => {
    if (filter.includes(value)) {
      setFilter(filter.filter((v) => v !== value));
    } else {
      setFilter([...filter, value]);
    }
  };

  // Helper for sorting columns
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Helper for rendering sort indicator
  const renderSortIndicator = (key) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container">
      <h2>NBA Cheat Sheet v2 ({sortedData.length})</h2>
      <div style={filterBarStyle}>
        <div>
          <span style={labelStyle}>Teams:</span>
          <span style={checkboxGroupStyle}>
            {uniqueTeams.map(team => (
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
            {uniquePlayers.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Features:</span>
          <span style={checkboxGroupStyle}>
            {uniqueFeatures.map(feature => (
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
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('team')}>
              Team{renderSortIndicator('team')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('feature')}>
              Feature{renderSortIndicator('feature')}
            </th>
            <th>Prop Line</th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('projection_diff')}>
              Projection{renderSortIndicator('projection_diff')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('opp_rank')}>
              Opp. Rank{renderSortIndicator('opp_rank')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('performance_last_5')}>
              Last 5{renderSortIndicator('performance_last_5')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('performance_last_10')}>
              Last 10{renderSortIndicator('performance_last_10')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('performance_last_15')}>
              Last 15{renderSortIndicator('performance_last_15')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('performance_h2h')}>
              H2H{renderSortIndicator('performance_h2h')}
            </th>
            <th className="sortable" style={{ cursor: 'pointer' }} onClick={() => handleSort('streak')}>
              Streak{renderSortIndicator('streak')}
            </th>
            <th>Correlated Picks</th>
            <th>Bet</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((p, idx) => {
            const perf = finalPerformance[p.participant.name + '_' + p.market_id] || {};
            return (
              <tr key={idx} style={{ height: '30px' }}>
                <td>
                  <img
                    src={getPlayerPhoto(p.participant.player)}
                    alt={p.participant.name}
                    width={30}
                    style={{ borderRadius: 6 }}
                  />
                </td>
                <td>{p.participant.name}</td>
                <td>
                  <img
                    src={getTeamLogo(getTeam(p.participant.player))}
                    alt={getTeam(p.participant.player)}
                    width={30}
                    style={{ borderRadius: 6 }}
                  />
                </td>
                <td>{getFeature(p.market_id)}</td>
                <td>{p.over?.line ?? p.under?.line ?? 'N/A'}</td>
                <td>{renderProjection(p.projection)}</td>
                <td>{renderOppositionRank(p.extra)}</td>
                <td>{renderOverUnderCell(perf.last_5, 5)}</td>
                <td>{renderOverUnderCell(perf.last_10, 10)}</td>
                <td>{renderOverUnderCell(perf.last_15, 15)}</td>
                <td>{renderOverUnderCell(perf.h2h, 3)}</td>
                <td>{renderStreak(perf)}</td>
                <td>{renderCorrelatedPicks(p.correlated_picks)}</td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}