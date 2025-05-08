import React, { useState, useEffect } from 'react';
import { getPlayerPhotoUrl } from '../utils';

// You can also import a normalizeName helper from utils if needed.
// import { normalizeName } from '../utils';

export default function MyBets() {
  const [bets, setBets] = useState([]);

  // Load bets from localStorage on mount.
  useEffect(() => {
    const storedBets = JSON.parse(localStorage.getItem('myBets')) || [];
    setBets(storedBets);
  }, []);

  // Remove bet based on index.
  const handleRemoveBet = (indexToRemove) => {
    const updatedBets = bets.filter((_, index) => index !== indexToRemove);
    setBets(updatedBets);
    localStorage.setItem('myBets', JSON.stringify(updatedBets));
  };

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
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet, index) => (
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
                  <strong>{bet.betType}</strong> {bet.threshold} {bet.feature}
                </td>
                <td>
                  <button onClick={() => handleRemoveBet(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
