import React, { useState } from 'react';

export default function BetModal({ player, onClose, onConfirm }) {
  const [choice, setChoice] = useState('Over');

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Add Bet for {player.player_name} {player.feature}</h3>
        <label>
          <input
            type="radio" value="Over" checked={choice==='Over'}
            onChange={()=>setChoice('Over')}
          /> Over
        </label>
        <label style={{marginLeft:'1rem'}}>
          <input
            type="radio" value="Under" checked={choice==='Under'}
            onChange={()=>setChoice('Under')}
          /> Under
        </label>
        <div style={{marginTop:'1rem'}}>
          <button onClick={() => onConfirm(choice)}>Confirm</button>
          <button onClick={onClose} style={{marginLeft:'1rem'}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
