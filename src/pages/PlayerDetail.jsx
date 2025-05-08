import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { getPlayerPhotoUrl} from '../utils';

// Helper to format an array of game values into data for a bar chart.
const formatGameData = (gameArray) => {
  if (!gameArray) return []; // Prevent error if undefined
  return gameArray.map((val, index) => ({
    name: `Game ${index + 1}`,
    value: parseFloat(val)
  }));
};

export default function PlayerDetail() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state || !state.player) {
    return <div>No player data available</div>;
  }

  const { player } = state;
  // Ensure we default to an empty array if there are no last15 or last3 values.
  const last15Data = formatGameData(player.last15);
  const last3Data = formatGameData(player.last3);

  return (
    <div className="container" style={{ padding: '1rem' }}>
      <button onClick={() => navigate(-1)}>Back</button>
      <h2>
        {player.player_name} - {player.feature} Prop
      </h2>
      <div className="player-info" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <img
          src={getPlayerPhotoUrl(player.player_name)}
          alt={player.player_name}
          style={{ width: 100, height: 100, marginRight: '1rem' }}
        />
        <div>
          <p>Team: {player.team_abbreviation}</p>
          <p>Opponent: {player.opponent}</p>
          <p>Prop Line: {player.threshold}</p>
        </div>
      </div>
      <div>
        <h3>Last 15 Games</h3>
        {last15Data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={last15Data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No data available for last 15 games.</p>
        )}
      </div>
      <div>
        <h3>Last 3 Head-to-Head Games</h3>
        {last3Data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={last3Data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No data available for last 3 head-to-head games.</p>
        )}
      </div>
    </div>
  );
}