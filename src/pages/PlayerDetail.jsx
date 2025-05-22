import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import { getPlayerPhotoUrl, getPlayerByName } from '../utils';

const metrics = [
  'ftm', 'fta', 'fg2m', 'fg3m', 'fg3a', 'fgm', 'fga', 'fg2a', 'game_date', 'opponent',
  'min', 'ast', 'reb', 'blk', 'stl', 'home_or_away', 'pts', 'plus_minus'
];

const proxyBase = 'https://cloudflare-cors-anywhere.ericecchan6.workers.dev/?';

const graphOptions = [
  { label: 'Last 5', value: 'L5', x: 5 },
  { label: 'Last 10', value: 'L10', x: 10 },
  { label: 'Last 15', value: 'L15', x: 15 },
  { label: 'Last 50', value: 'L50', x: 50 },
  { label: 'H2H', value: 'H2H', x: 10 },
];

export default function PlayerDetail() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGraph, setSelectedGraph] = useState('L15');

  const player = state && state.player;
  const playerObj = player ? getPlayerByName(player.player_name) : null;
  const playerId = playerObj?.id;
  const prop = player?.feature || 'pts';

  // Get opponent abbreviation for H2H
  const opponentAbbr = player?.opponent;

  useEffect(() => {
    if (!playerId) return;
    async function fetchGameData() {
      setLoading(true);
      setError(null);
      try {
        let apiUrl = `https://showstone.io/api/players/filter_by_player/?format=json&metrics=${metrics.join('&metrics=')}&player_id=${playerId}`;
        if (selectedGraph === 'H2H') {
          apiUrl += `&x=10&opponent=${opponentAbbr}`;
        } else {
          const x = graphOptions.find(opt => opt.value === selectedGraph)?.x || 15;
          apiUrl += `&x=${x}`;
        }
        const proxyUrl = `${proxyBase}${encodeURIComponent(apiUrl)}`;
        const res = await fetch(proxyUrl);
        const data = await res.json();
        setGameData(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Failed to fetch player game data.');
      } finally {
        setLoading(false);
      }
    }
    fetchGameData();
    // eslint-disable-next-line
  }, [playerId, prop, selectedGraph, opponentAbbr]);

  if (!player) {
    return <div>No player data available</div>;
  }

  // Prepare data for the bar chart (most recent game on right)
  const propKeys = prop.includes('_') ? prop.split('_') : [prop];

  const barChartData = [...gameData].reverse().map((g, idx) => {
    let value = 0;
    for (const k of propKeys) {
      value += g[k] != null ? Number(g[k]) : 0;
    }
    return {
      name: g.game_date ? `${g.game_date} (${g.opponent})` : `Game ${gameData.length - idx}`,
      value,
      opponent: g.opponent,
    };
  });

  // Calculate over/under counts for the prop
  const overCount = barChartData.filter(g => g.value > Number(player.threshold)).length;
  const underCount = barChartData.filter(g => g.value < Number(player.threshold)).length;

  // Color logic for each bar
  const getBarColor = (value, threshold) => {
    if (value > threshold) return '#22c55e'; // green
    if (value < threshold) return '#ef4444'; // red
    return '#a3a3a3'; // gray
  };

  return (
    <div className="container" style={{ padding: '1rem' }}>
      <button onClick={() => navigate(-1)}>Back</button>
      <h2>
        {player.player_name}
      </h2>
      <div className="player-info" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <img
          src={getPlayerPhotoUrl(player.player_name)}
          alt={player.player_name}
          style={{ width: 130, height: 100, marginRight: '1rem' }}
        />
        <div>
          <p>Team: {player.team_abbreviation}</p>
          <p>Opponent: {player.opponent}</p>
          <p>Prop Line: {player.threshold}</p>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        {graphOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelectedGraph(opt.value)}
            style={{
              marginRight: 8,
              background: selectedGraph === opt.value ? '#38bdf8' : '#1a202c',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 12px',
              fontWeight: selectedGraph === opt.value ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div>
        <h3>
          {graphOptions.find(opt => opt.value === selectedGraph)?.label || 'Last 15'} Games ({prop.toUpperCase()})
          <span style={{ marginLeft: 16, fontSize: 16 }}>
            Over: {overCount} &nbsp; Under: {underCount}
          </span>
        </h3>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : barChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              {/* Tooltip removed */}
              <Bar
                dataKey="value"
                isAnimationActive={false}
                fill="#8884d8"
              >
                {barChartData.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={getBarColor(entry.value, Number(player.threshold))}
                  />
                ))}
              </Bar>
              <ReferenceLine
                y={Number(player.threshold)}
                stroke="#000"
                strokeWidth={4}
                ifOverflow="extendDomain"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No data available for selected games.</p>
        )}
      </div>
    </div>
  );
}