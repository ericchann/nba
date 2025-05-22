import json
from nba_api.stats.static import players

def main():
    nba_players = players.get_players()
    wnba_players = players.get_wnba_players()

    # Save NBA players
    with open('nba_players.json', 'w') as f:
        json.dump(nba_players, f, indent=2)

    # Save WNBA players
    with open('wnba_players.json', 'w') as f:
        json.dump(wnba_players, f, indent=2)

    # Save merged list
    all_players = nba_players + wnba_players
    # Remove duplicates by player id (if any)
    unique_players = {str(player['id']): player for player in all_players}
    merged_players = list(unique_players.values())
    with open('all_players.json', 'w') as f:
        json.dump(merged_players, f, indent=2)

if __name__ == "__main__":
    main()