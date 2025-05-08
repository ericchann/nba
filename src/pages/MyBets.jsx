import React, { useState, useEffect } from 'react';
import { getPlayerPhotoUrl } from '../utils';

// ProgressBar component
const ProgressBar = ({ value, threshold, label }) => {
  if (value == null || threshold == null) return null;
  const percent = Math.max(0, Math.min(100, (value / threshold) * 100));
  return (
    <div style={{ width: 120, marginTop: 4 }}>
      <div style={{
        background: '#334155',
        borderRadius: 6,
        height: 14,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div
          style={{
            width: `${percent}%`,
            background: percent >= 100 ? '#22c55e' : '#38bdf8',
            height: '100%',
            transition: 'width 0.3s',
          }}
        />
        {/* Prop line marker */}
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(100, (threshold / Math.max(threshold, value)) * 100)}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: '#fbbf24',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: '#b0b8c1', marginTop: 2 }}>
        {label}: {value} / <span style={{ color: '#fbbf24' }}>{threshold}</span>
      </div>
    </div>
  );
};

export default function MyBets() {
  const [bets, setBets] = useState([]);
  const [pastBets, setPastBets] = useState([]);
  const [liveData, setLiveData] = useState(null);

  // Load bets from localStorage on mount.
  useEffect(() => {
    const storedBets = JSON.parse(localStorage.getItem('myBets')) || [];
    setBets(storedBets);
    const storedPastBets = JSON.parse(localStorage.getItem('pastBets')) || [];
    setPastBets(storedPastBets);
  }, []);

  // Fetch live data on mount.
  useEffect(() => {
    async function fetchLiveData() {
      try {
        const url = 'https://cloudflare-cors-anywhere.ericecchan6.workers.dev/?https://showstone.io/api/live-data/';
        const res = await fetch(url);
        const data = await res.json();
        setLiveData(data);
      } catch (e) {
        setLiveData(null);
      }
    }
    fetchLiveData();
  }, []);

  // Remove bet based on index.
  const handleRemoveBet = (indexToRemove) => {
    const updatedBets = bets.filter((_, index) => index !== indexToRemove);
    setBets(updatedBets);
    localStorage.setItem('myBets', JSON.stringify(updatedBets));
  };

  // Remove past bet
  const handleRemovePastBet = (indexToRemove) => {
    const updatedPastBets = pastBets.filter((_, index) => index !== indexToRemove);
    setPastBets(updatedPastBets);
    localStorage.setItem('pastBets', JSON.stringify(updatedPastBets));
  };

  // Map feature to display label
  const featureLabel = (feature) => {
    switch (feature) {
      case 'pts': return 'Points';
      case 'ast': return 'Assists';
      case 'reb': return 'Rebounds';
      case 'pts_ast': return 'PA';
      case 'pts_reb': return 'PR';
      case 'ast_reb': return 'RA';
      case 'pts_ast_reb': return 'PRA';
      default: return feature;
    }
  };

  // Map feature to API key
  const featureKey = (feature) => {
    switch (feature) {
      case 'pts_ast': return 'pts+ast';
      case 'pts_reb': return 'pts+reb';
      case 'ast_reb': return 'ast+reb';
      case 'pts_ast_reb': return 'pts+ast+reb';
      default: return feature;
    }
  };

  // Helper to get status and stat for a bet
  const getStatusAndStat = (bet) => {
    if (!liveData || !liveData.games) return { status: 'Game Not Started', stat: null };
    for (const game of liveData.games) {
      const player = game.players.find(
        (p) => p.name.toLowerCase() === bet.name.toLowerCase()
      );
      if (player) {
        const statVal = player[featureKey(bet.feature)];
        const status = game.gameInfo?.status || 'Game Not Started';
        return { status, stat: statVal };
      }
    }
    return { status: 'Game Not Started', stat: null };
  };

  // Move final bets to past bets
  useEffect(() => {
    if (!liveData || !liveData.games || bets.length === 0) return;
    let newBets = [...bets];
    let newPastBets = [...pastBets];
    let changed = false;

    bets.forEach((bet, idx) => {
      const { status, stat } = getStatusAndStat(bet);
      if (status === 'Final') {
        // Add stat and status to bet for record
        const betWithResult = { ...bet, finalStat: stat, finalStatus: status };
        newPastBets.push(betWithResult);
        newBets = newBets.filter((_, i) => i !== idx);
        changed = true;
      }
    });

    if (changed) {
      setBets(newBets);
      setPastBets(newPastBets);
      localStorage.setItem('myBets', JSON.stringify(newBets));
      localStorage.setItem('pastBets', JSON.stringify(newPastBets));
    }
    // eslint-disable-next-line
  }, [liveData]);

  // Helper for Win/Lose
  const getWinLose = (bet) => {
    if (bet.finalStat == null) return null;
    const threshold = parseFloat(bet.threshold);
    if (bet.betType === 'Over') {
      return bet.finalStat > threshold ? 'Win' : 'Lose';
    } else if (bet.betType === 'Under') {
      return bet.finalStat < threshold ? 'Win' : 'Lose';
    }
    return null;
  };

  // Calculate win/loss record for past bets
  const winCount = pastBets.filter(bet => getWinLose(bet) === 'Win').length;
  const lossCount = pastBets.filter(bet => getWinLose(bet) === 'Lose').length;

  return (
    <div className="container">
      <h2>My Bets</h2>
      {bets.length === 0 ? (
        <p>You have no bets yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr style={{ height: '30px' }}>
              <th>Photo</th>
              <th>Player</th>
              <th>Details</th>
              <th>Status</th>
              <th>Current Stat</th>
              <th>Status Bar</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet, index) => {
              const { status, stat } = getStatusAndStat(bet);
              return (
                <tr key={index} style={{ height: '30px' }}>
                  <td>
                    <img
                      src={getPlayerPhotoUrl(bet.name)}
                      alt={bet.name}
                      width={30}
                    />
                  </td>
                  <td>{bet.name}</td>
                  <td>
                    <strong>{bet.betType}</strong> {bet.threshold} {featureLabel(bet.feature)}
                  </td>
                  <td>
                    <b>{status}</b>
                  </td>
                  <td>
                    {stat !== undefined && stat !== null
                      ? <span><b>{featureLabel(bet.feature)}:</b> {stat}</span>
                      : 'N/A'}
                  </td>
                  <td>
                    <ProgressBar
                      value={stat}
                      threshold={parseFloat(bet.threshold)}
                      label={featureLabel(bet.feature)}
                    />
                  </td>
                  <td>
                    <button onClick={() => handleRemoveBet(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 40 }}>
        Past Bets
        <span style={{ fontSize: 18, color: '#38bdf8', marginLeft: 16 }}>
          ({winCount}-{lossCount})
        </span>
      </h2>
      {pastBets.length === 0 ? (
        <p>No past bets yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr style={{ height: '30px' }}>
              <th>Photo</th>
              <th>Player</th>
              <th>Details</th>
              <th>Status</th>
              <th>Final Stat</th>
              <th>Win/Lose</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {pastBets.map((bet, index) => {
              const winLose = getWinLose(bet);
              return (
                <tr key={index} style={{ height: '30px' }}>
                  <td>
                    <img
                      src={getPlayerPhotoUrl(bet.name)}
                      alt={bet.name}
                      width={30}
                    />
                  </td>
                  <td>{bet.name}</td>
                  <td>
                    <strong>{bet.betType}</strong> {bet.threshold} {featureLabel(bet.feature)}
                  </td>
                  <td>
                    <b>{bet.finalStatus || 'Final'}</b>
                  </td>
                  <td>
                    {bet.finalStat !== undefined && bet.finalStat !== null
                      ? <span><b>{featureLabel(bet.feature)}:</b> {bet.finalStat}</span>
                      : 'N/A'}
                  </td>
                  <td>
                    {winLose && (
                      <span
                        style={{
                          background: winLose === 'Win' ? '#22c55e' : '#ef4444',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        {winLose}
                      </span>
                    )}
                  </td>
                  <td>
                    <button onClick={() => handleRemovePastBet(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}