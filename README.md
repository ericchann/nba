# NBA Cheat Sheet

This is a React web application that provides a comprehensive NBA player prop cheat sheet. It allows users to view, filter, and sort NBA player prop data, including recent performance trends, for making informed betting or fantasy decisions.

## Features

- **Player Prop Table:** Displays NBA players with their prop lines and recent over/under stats for the last 5, 10, and 15 games, as well as head-to-head (H2H) stats.
- **Multi-Select Filtering:** Filter the table by one or more teams and features (stat types), and by a single player.
- **Sorting:** Click any column header to sort by that column (e.g., by player name, team, prop, feature, or over/under counts).
- **Team & Opponent Logos:** See team and opponent logos for quick visual reference.
- **Add Bets:** Add "Over" or "Under" bets for any player/prop to your local storage for tracking.
- **Responsive UI:** Modern, dark-themed interface with a styled filter bar and sortable table.

## How It Works

- **Data Source:** The app fetches NBA player prop data from [showstone.io](https://showstone.io) via a CORS proxy.
- **Caching:** Last 15 games for each player are fetched only once and cached for efficient filtering and sorting.
- **Filtering:** Use the filter bar at the top to select teams, players, and features to display only the props you care about.
- **Sorting:** By default, the table is sorted by "Last 10" (L10) over/under count in descending order.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Open your browser:**  
   Visit [http://localhost:3000](http://localhost:3000) to use the app.

## Project Structure

- `src/pages/CheatSheet.jsx` — Main page and logic for the NBA cheat sheet.
- `src/utils.js` — Utility functions (e.g., for player photos, team slugs).
- `src/player_ids.json` — Mapping of player names to unique IDs for API calls.

## Customization

- **Add/Remove Features:** You can adjust which features/stat types are shown by editing the data source or filtering logic.
- **Styling:** The filter bar and table are styled for a dark theme, but you can customize the CSS in the component as needed.

## License

MIT

---

**Note:** This project is not affiliated with the NBA or any betting provider. Data is for informational purposes only.