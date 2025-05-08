import pandas as pd
from nba_api.stats.endpoints import (
    playergamelog,
    leaguedashteamstats,
    playerdashboardbygeneralsplits
)
from nba_api.stats.static import players, teams
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

# --- 1. Data Fetching Functions ---

def fetch_player_logs(player_name, season='2024-25'):
    match = [p for p in players.get_players() if p['full_name'].lower() == player_name.lower()]
    if not match:
        raise ValueError(f"Player '{player_name}' not found.")
    pid = match[0]['id']
    df = playergamelog.PlayerGameLog(player_id=pid, season=season).get_data_frames()[0]
    df['GAME_DATE'] = pd.to_datetime(df['GAME_DATE'])
    return df.sort_values('GAME_DATE')


def fetch_team_metrics(team_name, season='2024-25'):
    # Match team_id from static teams list
    tmatch = [t for t in teams.get_teams() if t['full_name'].lower() == team_name.lower()]
    if not tmatch:
        raise ValueError(f"Team '{team_name}' not found.")
    tid = tmatch[0]['id']
    # Fetch league dash team stats and filter by TEAM_ID
    stats = leaguedashteamstats.LeagueDashTeamStats(
        season=season,
        season_type_all_star='Regular Season'
    ).get_data_frames()[0]
    row = stats[stats['TEAM_ID'] == tid]
    if row.empty:
        raise ValueError(f"Team stats for '{team_name}' (ID {tid}) not found in league dashboard.")
    row = row.iloc[0]
    return {
        'OFF_RATING': row['OFF_RATING'],
        'DEF_RATING': row['DEF_RATING'],
        'NET_RATING': row['NET_RATING'],
        'PACE': row['PACE']
    }


def fetch_on_off_metrics(player_name, season='2024-25'):
    pid = players.find_players_by_full_name(player_name)[0]['id']
    dash = playerdashboardbygeneralsplits.PlayerDashboardByGeneralSplits(
        player_id=pid,
        season=season,
        season_type_all_star='Regular Season'
    )
    df = dash.get_data_frames()[0]
    overall = df[df['GROUP_SET'] == 'Overall'].iloc[0]
    return {'REAL_PLUS_MINUS': overall['PLUS_MINUS']}

# --- 2. Feature Engineering ---

def create_features(df, player_name, team_name, opp_team, season='2024-25'):
    df = df.copy()
    # Counting & efficiency stats
    df['PTS'] = df['PTS'].astype(int)
    df['AST'] = df['AST'].astype(int)
    df['REB'] = df['REB'].astype(int)
    df['TO']  = df['TOV'].astype(int)
    df['eFG%'] = (df['FGM'] + 0.5 * df['FG3M']) / df['FGA']
    df['TS%']  = df['PTS'] / (2 * (df['FGA'] + 0.44 * df['FTA']))

    # Home/Away flag
    df['HOME'] = df['MATCHUP'].apply(lambda m: 1 if ' vs ' in m else 0)

    # Rest & fatigue
    df['days_rest'] = df['GAME_DATE'].diff().dt.days.fillna(2)
    df['b2b'] = df['days_rest'].apply(lambda d: 1 if d == 1 else 0)

    # Rolling averages
    df['pts_last5_avg'] = df['PTS'].rolling(5).mean().shift(1)
    df['ts_last5_avg']  = df['TS%'].rolling(5).mean().shift(1)

    # Team-level ratings and pace
    tm = fetch_team_metrics(team_name, season)
    for k, v in tm.items():
        df[k] = v
    # Opponent ratings
    ot = fetch_team_metrics(opp_team, season)
    df['OPP_OFF_RATING'] = ot['OFF_RATING']
    df['OPP_DEF_RATING'] = ot['DEF_RATING']

    # On/off plus-minus
    oom = fetch_on_off_metrics(player_name, season)
    df['REAL_PLUS_MINUS'] = oom['REAL_PLUS_MINUS']

    # Placeholder: injury risk & projected minutes
    df['injury_risk'] = 0.1
    df['proj_minutes'] = pd.to_numeric(df['MIN'], errors='coerce')

    # Schedule context
    df['four_in_five'] = df['days_rest'].rolling(5).apply(lambda arr: arr.count() >= 4)

    # Regression-to-mean
    df['shrunk_pts_avg'] = (
        df['pts_last5_avg'] * df['GAME_ID'].rank() + df['PTS'].mean()
    ) / (df['GAME_ID'].rank() + 1)

    return df.dropna()

# --- 3. Model Prep & Training ---

def prepare_and_train(player_name, team_name, opp_team, season='2024-25'):
    logs = fetch_player_logs(player_name, season)
    feats = create_features(logs, player_name, team_name, opp_team, season)
    X = feats[[
        'AST', 'REB', 'TO', 'eFG%', 'TS%', 'HOME', 'days_rest', 'b2b',
        'pts_last5_avg', 'ts_last5_avg',
        'OFF_RATING', 'DEF_RATING', 'NET_RATING', 'PACE',
        'OPP_OFF_RATING', 'OPP_DEF_RATING',
        'REAL_PLUS_MINUS', 'injury_risk', 'proj_minutes',
        'four_in_five', 'shrunk_pts_avg'
    ]]
    y = feats['PTS']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    rmse = mean_squared_error(y_test, preds, squared=False)
    print(f"Test RMSE: {rmse:.2f} points")
    return model

# --- 4. Example Usage ---

if __name__ == '__main__':
    PLAYER = 'LeBron James'
    TEAM   = 'Los Angeles Lakers'
    OPP    = 'Golden State Warriors'

    model = prepare_and_train(PLAYER, TEAM, OPP)
