import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CheatSheet from './pages/CheatSheet';
import MyBets      from './pages/MyBets';
import './App.css';

function App() {
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

  return (
    <BrowserRouter>
      <nav className="navbar">
        <Link to="/"     className="nav-button">Cheat Sheet</Link>
        <Link to="/bets" className="nav-button">
          My Bets ({activeBets.length})
        </Link>
      </nav>
      <Routes>
        <Route
          path="/"
          element={<CheatSheet onAddBet={addBet} />}
        />
        <Route
          path="/bets"
          element={
            <MyBets
              activeBets={activeBets}
              pastBets   ={pastBets}
              onRemoveActive={removeActive}
              onRemovePast  ={removePast}
              onArchive     ={archiveBet}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
