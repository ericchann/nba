#!/usr/bin/env python3
"""
generate_nba_feature_stats.py

Fetch Showstone cheat‐sheet via HTTP, enrich with nba_api last-15 & last-3-vs-opponent
(across Regular Season AND Playoffs), split composite features correctly, include
each game’s date, opponent and the feature name itself, then emit public/data/nba_feature_stats.json.
"""

import os
import re
import json
import time
import requests
import pandas as pd
from nba_api.stats.static import players
from nba_api.stats.endpoints import PlayerGameLog

# === CONFIG ===
SHOWSTONE_URL = 'https://showstone.io/api/cheat-sheet/?format=json'
OUTPUT_PATH   = os.path.join('public', 'data', 'nba_feature_stats.json')
SEASON        = '2024-25'
PAUSE_SEC     = 0.6

def fetch_showstone_data():
    r = requests.get(SHOWSTONE_URL, timeout=10)
    r.raise_for_status()
    return r.json()

def get_player_id(name):
    matches = players.find_players_by_full_name(name)
    return matches[0]['id'] if matches else None

def fetch_and_combine_logs(pid):
    dfs = []
    for st in ('Regular Season', 'Playoffs'):
        try:
            df = PlayerGameLog(
                player_id=pid,
                season=SEASON,
                season_type_all_star=st
            ).get_data_frames()[0]
            if not df.empty:
                dfs.append(df)
        except Exception as e:
            print(f"⚠️ Error fetching {st} for {pid}: {e}")
        time.sleep(PAUSE_SEC)
    if not dfs:
        return pd.DataFrame()
    all_logs = pd.concat(dfs, ignore_index=True)
    all_logs['GAME_DATE'] = pd.to_datetime(all_logs['GAME_DATE'])
    return all_logs.sort_values('GAME_DATE', ascending=False)

def main():
    start = time.time()
    sheet = fetch_showstone_data()
    print(f"🔍 Loaded {len(sheet)} players from Showstone")

    output = []
    for entry in sheet:
        name     = entry['player_name']
        feat_str = entry.get('feature', '')
        # split on commas AND underscores: e.g. "pts,reb" or "pts_reb"
        parts = re.split(r'[,_]', feat_str)
        cols  = [p.strip().upper() for p in parts if p.strip()]
        opp    = entry.get('opponent', '').upper()

        pid = get_player_id(name)
        l15_vals, l15_dates, l15_opps = [], [], []
        l3_vals,  l3_dates,  l3_opps  = [], [], []

        if pid:
            logs = fetch_and_combine_logs(pid)
            if not logs.empty:
                # last 15 games
                for _, row in logs.head(15).iterrows():
                    total = sum(row.get(c, 0) for c in cols)
                    l15_vals.append(total)
                    l15_dates.append(row['GAME_DATE'].strftime('%Y-%m-%d'))
                    l15_opps.append(row['MATCHUP'].split()[-1].rstrip('.'))

                # last 3 vs this opponent
                if opp:
                    vs = logs[logs['MATCHUP'].str.endswith(opp)].head(3)
                    for _, row in vs.iterrows():
                        total = sum(row.get(c, 0) for c in cols)
                        l3_vals.append(total)
                        l3_dates.append(row['GAME_DATE'].strftime('%Y-%m-%d'))
                        l3_opps.append(row['MATCHUP'].split()[-1].rstrip('.'))

        output.append({
            "player_name": name,
            "feature": feat_str,
            "last15_feature": l15_vals,
            "last15_game_dates": l15_dates,
            "last15_opponents": l15_opps,
            "last3_vs_opponent_feature": l3_vals,
            "last3_game_dates": l3_dates,
            "last3_opponents": l3_opps
        })

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    elapsed = time.time() - start
    print(f"✅ Wrote {len(output)} entries to {OUTPUT_PATH}")
    print(f"⏱ Total runtime: {elapsed:.2f}s")

if __name__ == '__main__':
    main()
