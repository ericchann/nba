import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import CheatSheet from './pages/CheatSheet';
import MyBets from './pages/MyBets';
import PlayerDetail from './pages/PlayerDetail'; // Import the PlayerDetail page
import './App.css';

export default function App() {
  // Load from localStorage
  const [activeBets, setActiveBets] = useState(() => {
    const raw = localStorage.getItem('activeBets');
    return raw ? JSON.parse(raw) : [];
  });
  const [pastBets, setPastBets] = useState(() => {
    const raw = localStorage.getItem('pastBets');
    return raw ? JSON.parse(raw) : [];
  });

  // Persist whenever they change
  useEffect(() => {
    localStorage.setItem('activeBets', JSON.stringify(activeBets));
  }, [activeBets]);
  useEffect(() => {
    localStorage.setItem('pastBets', JSON.stringify(pastBets));
  }, [pastBets]);

  // 1) addBet now takes (player, type)
  const addBet = (player, type) => {
    const now = new Date().toISOString();
    const bet = {
      id: Date.now(),
      datePlaced: now,
      player_name: player.player_name,
      team_abbreviation: player.team_abbreviation,
      opponent: player.opponent,
      threshold: player.threshold,
      feature: player.feature,
      betType: type,    // ← critical
    };
    setActiveBets(prev => [...prev, bet]);
  };

  // 2) archiveBet also carries betType + datePlaced
  const archiveBet = (bet, finalStat) => {
    const thresh = parseFloat(bet.threshold);
    const win    = bet.betType === 'Over'
      ? finalStat > thresh
      : finalStat < thresh;
    const archived = {
      ...bet,
      finalStat,
      result: win ? 'Win' : 'Loss',
    };
    setActiveBets(prev => prev.filter(b => b.id !== bet.id));
    setPastBets  (prev => [...prev, archived]);
  };

  const removeActive = id => setActiveBets(prev => prev.filter(b => b.id !== id));
  const removePast   = id => setPastBets  (prev => prev.filter(b => b.id !== id));

  // NEW: State for tracking number of bets.
  const [betCount, setBetCount] = useState(0);

  useEffect(() => {
    const updateBetCount = () => {
      const savedBets = JSON.parse(localStorage.getItem('myBets')) || [];
      setBetCount(savedBets.length);
    };

    updateBetCount();
    // Poll every second for changes.
    const intervalId = setInterval(updateBetCount, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const [data, setData] = useState([]);
  const [headToHeadMap, setHeadToHeadMap] = useState({});
  const last15GamesCache = useRef({});

  return (
    <BrowserRouter basename="/nba">
      <nav className="navbar">
        <Link to="/cheatsheet" className="nav-button">
          Cheat Sheet
        </Link>
        <Link to="/bets" className="nav-button">
          My Bets ({betCount})
        </Link>
      </nav>
      <Routes>
        <Route
          path="/cheatsheet"
          element={
            <CheatSheet
              onAddBet={addBet}
              data={data}
              setData={setData}
              headToHeadMap={headToHeadMap}
              setHeadToHeadMap={setHeadToHeadMap}
              last15GamesCache={last15GamesCache}
            />
          }
        />
        <Route
          path="/bets"
          element={
            <MyBets
              activeBets={activeBets}
              pastBets={pastBets}
              onRemoveActive={removeActive}
              onRemovePast={removePast}
              onArchive={archiveBet}
            />
          }
        />
        {/* New route for PlayerDetail page */}
        <Route path="/player/:id" element={<PlayerDetail />} />
        <Route path="*" element={<Navigate to="/cheatsheet" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
