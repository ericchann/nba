// src/pages/CheatSheet.jsx

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { getPlayerPhotoUrl, teamSlugMap } from '../utils';

export default function CheatSheet({ onAddBet }) {
  const [data, setData] = useState([]);
  const [sortedData, setSortedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Helper: team logo URL
  const getTeamLogo = (abbr) => {
    const slug = teamSlugMap[abbr];
    return slug
      ? `https://showstone.io/team_logos/${slug}.png`
      : 'https://via.placeholder.com/20';
  };

  // Helper: array average
  const avg = (arr) =>
    arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;

  // Count overs vs unders in first n games
  const getOverUnderCount = (arr, thresh, n) => {
    const slice = arr.slice(0, n);
    let over = 0,
      under = 0;
    slice.forEach((v) => {
      if (v > thresh) over++;
      else if (v < thresh) under++;
    });
    return { over, under };
  };

  // Render over/under majority
  const renderOU = (over, under, n) => {
    let display, cls;
    if (over > under) {
      display = `${over}/${n}`;
      cls = 'trend-green';
    } else if (under > over) {
      display = `${under}/${n}`;
      cls = 'trend-red';
    } else {
      display = `${over}/${n}`;
      cls = 'trend-yellow';
    }
    return <span className={cls}>{display}</span>;
  };

  // Mini bar chart renderer
  const renderBar = (vals, dates, opps, thresh, feat, w = 150, h = 40) => {
    const chartData = vals
      .map((v, i) => ({
        game: i + 1,
        value: v,
        date: dates[i],
        opponent: opps[i],
      }))
      .reverse();

    return (
      <ResponsiveContainer width={w} height={h}>
        <BarChart data={chartData}>
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ fontSize: '0.7rem', pointerEvents: 'none', zIndex: 1000 }}
            formatter={(val) => [val, feat]}
            labelFormatter={(_, payload) => {
              if (!payload || !payload[0]) return '';
              const { date, opponent } = payload[0].payload;
              return `${date} vs ${opponent}`;
            }}
            cursor={false}
          />
          <Bar dataKey="value">
            {chartData.map((e, i) => {
              let fill = '#999';
              if (e.value > thresh) fill = '#4caf50';
              else if (e.value < thresh) fill = '#f44336';
              return <Cell key={i} fill={fill} />;
            })}
          </Bar>
          <ReferenceLine y={thresh} stroke="#000" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Fetch Showstone + feature stats
  useEffect(() => {
    async function load() {
      try {
        const [showRes, featRes] = await Promise.all([
          fetch('https://showstone.io/api/cheat-sheet/?format=json'),
          fetch('/data/nba_feature_stats.json'),
        ]);
        const showData = await showRes.json();
        const featData = await featRes.json();

        const merged = showData.map((p) => {
          const stat =
            featData.find(
              (f) => f.player_name === p.player_name && f.feature === p.feature
            ) || {};
          return {
            ...p,
            last15: stat.last15_feature || [],
            last15_dates: stat.last15_game_dates || [],
            last15_opps: stat.last15_opponents || [],
            last3: stat.last3_vs_opponent_feature || [],
            last3_dates: stat.last3_game_dates || [],
            last3_opps: stat.last3_opponents || [],
          };
        });

        setData(merged);
        setSortedData(merged);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Sorting effect
  useEffect(() => {
    let list = [...data];
    const { key, direction, accessor } = sortConfig;
    if (key) {
      list.sort((a, b) => {
        const va = accessor ? accessor(a) : a[key];
        const vb = accessor ? accessor(b) : b[key];
        if (typeof va === 'number') {
          return direction === 'asc' ? va - vb : vb - va;
        }
        return direction === 'asc'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }
    setSortedData(list);
  }, [data, sortConfig]);

  // Click-to-sort handler
  const handleSort = (key, accessor = null) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction, accessor });
  };

  // New: forward player + choice to App.addBet
  const handleAddBet = (player, type) => {
    onAddBet(player, type);
  };

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2>NBA Cheat Sheet</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Photo</th>
              <th
                className="clickable"
                onClick={() => handleSort('player_name')}
              >
                Player {sortConfig.key === 'player_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Team</th>
              <th>Opponent</th>
              <th
                className="clickable"
                onClick={() => handleSort('threshold', (p) => parseFloat(p.threshold))}
              >
                Prop Line {sortConfig.key === 'threshold' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="clickable"
                onClick={() => handleSort('feature')}
              >
                Feature {sortConfig.key === 'feature' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="clickable"
                onClick={() => handleSort('last15avg', (p) => avg(p.last15))}
              >
                L15 {sortConfig.key === 'last15avg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Trend</th>
              <th
                className="clickable"
                onClick={() => handleSort('last3avg', (p) => avg(p.last3))}
              >
                Last 3 {sortConfig.key === 'last3avg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="clickable"
                onClick={() =>
                  handleSort('over5', (p) => {
                    const { over, under } = getOverUnderCount(p.last15, parseFloat(p.threshold), 5);
                    return Math.max(over, under);
                  })
                }
              >
                Last 5 {sortConfig.key === 'over5' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="clickable"
                onClick={() =>
                  handleSort('over10', (p) => {
                    const { over, under } = getOverUnderCount(p.last15, parseFloat(p.threshold), 10);
                    return Math.max(over, under);
                  })
                }
              >
                Last 10 {sortConfig.key === 'over10' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="clickable"
                onClick={() =>
                  handleSort('over15', (p) => {
                    const { over, under } = getOverUnderCount(p.last15, parseFloat(p.threshold), 15);
                    return Math.max(over, under);
                  })
                }
              >
                Last 15 {sortConfig.key === 'over15' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Bet</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((p) => {
              const threshold = parseFloat(p.threshold);
              const trendAvg = avg(p.last15);
              const { over: o5, under: u5 } = getOverUnderCount(p.last15, threshold, 5);
              const { over: o10, under: u10 } = getOverUnderCount(p.last15, threshold, 10);
              const { over: o15, under: u15 } = getOverUnderCount(p.last15, threshold, 15);

              return (
                <tr key={`${p.id}-${p.feature}`}>
                  <td>
                    <img
                      src={getPlayerPhotoUrl(p.player_name)}
                      alt={p.player_name}
                      className="photo"
                    />
                  </td>
                  <td>{p.player_name}</td>
                  <td>
                    <img
                      src={getTeamLogo(p.team_abbreviation)}
                      alt={p.team_abbreviation}
                      width={50}
                      height={50}
                    />
                  </td>
                  <td>
                    <img
                      src={getTeamLogo(p.opponent)}
                      alt={p.opponent}
                      width={50}
                      height={50}
                    />
                  </td>
                  <td>{p.threshold}</td>
                  <td>{p.feature}</td>
                  <td>
                    {renderBar(
                      p.last15,
                      p.last15_dates,
                      p.last15_opps,
                      threshold,
                      p.feature
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        trendAvg > threshold
                          ? 'trend-green'
                          : trendAvg < threshold
                          ? 'trend-red'
                          : 'trend-yellow'
                      }
                    >
                      {trendAvg > threshold
                        ? 'Over'
                        : trendAvg < threshold
                        ? 'Under'
                        : 'Even'}
                    </span>
                  </td>
                  <td>
                    {renderBar(
                      p.last3,
                      p.last3_dates,
                      p.last3_opps,
                      threshold,
                      p.feature,
                      100,
                      30
                    )}
                  </td>
                  <td>{renderOU(o5, u5, 5)}</td>
                  <td>{renderOU(o10, u10, 10)}</td>
                  <td>{renderOU(o15, u15, 15)}</td>
                  <td>
                    <button onClick={() => handleAddBet(p, 'Over')}>Over</button>
                    <button onClick={() => handleAddBet(p, 'Under')} style={{ marginLeft: 4 }}>
                      Under
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
