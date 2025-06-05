// ======================
// Constants & Configuration
// ======================
const DEFAULT_CONFIG = {
  league_id: null,
  api_url: 'https://api.example.com/matches',
  refresh_interval: 60, // in minutes
  show_logos: true,
  max_matches: 10,
  show_league_name: true,
  date_format: 'short',
};

// ======================
// Helper Functions
// ======================
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString, format = 'short') => {
  const date = new Date(dateString);
  const options = format === 'long' 
    ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString([], options);
};

// ======================
// Custom Element Class
// ======================
class SoccerMatchCard extends HTMLElement {
  static get styles() {
    return `
      .card {
        padding: 16px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .league-name {
        font-size: 1.2rem;
        font-weight: bold;
      }
      .refresh-button {
        cursor: pointer;
      }
      .match {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color);
      }
      .teams {
        flex: 1;
        display: flex;
        align-items: center;
      }
      .team {
        display: flex;
        align-items: center;
      }
      .team-home {
        justify-content: flex-end;
        text-align: right;
      }
      .team-logo {
        width: 24px;
        height: 24px;
        margin: 0 8px;
      }
      .score {
        font-weight: bold;
        margin: 0 12px;
        min-width: 40px;
        text-align: center;
      }
      .match-time {
        color: var(--secondary-text-color);
        min-width: 60px;
        text-align: right;
      }
      .error {
        color: var(--error-color);
        padding: 16px;
        text-align: center;
      }
    `;
  }

  constructor() {
    super();
    this._config = { ...DEFAULT_CONFIG };
    this._matches = [];
    this._error = null;
    this._refreshInterval = null;
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config || !config.league_id) {
      throw new Error('Invalid configuration: league_id is required');
    }

    this._config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    this._fetchData();
    this._setupRefresh();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    this._clearRefresh();
  }

  async _fetchData() {
    try {
      const response = await fetch(`${this._config.api_url}?league_id=${this._config.league_id}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      this._matches = data.matches.slice(0, this._config.max_matches);
      this._error = null;
    } catch (err) {
      console.error('Failed to fetch match data:', err);
      this._error = err.message;
      this._matches = [];
    } finally {
      this._render();
    }
  }

  _setupRefresh() {
    this._clearRefresh();
    if (this._config.refresh_interval > 0) {
      const intervalMs = this._config.refresh_interval * 60 * 1000;
      this._refreshInterval = setInterval(() => this._fetchData(), intervalMs);
    }
  }

  _clearRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  _render() {
    if (!this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = SoccerMatchCard.styles;

    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    content.className = 'card';

    // Header with league name and refresh button
    const header = document.createElement('div');
    header.className = 'header';

    if (this._config.show_league_name) {
      const leagueName = document.createElement('div');
      leagueName.className = 'league-name';
      leagueName.textContent = this._config.league_name || 'Soccer Matches';
      header.appendChild(leagueName);
    }

    const refreshButton = document.createElement('div');
    refreshButton.className = 'refresh-button';
    refreshButton.innerHTML = '<ha-icon icon="mdi:refresh"></ha-icon>';
    refreshButton.addEventListener('click', () => this._fetchData());
    header.appendChild(refreshButton);

    content.appendChild(header);

    // Error message or matches list
    if (this._error) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error';
      errorElement.textContent = this._error;
      content.appendChild(errorElement);
    } else if (this._matches.length === 0) {
      const noMatches = document.createElement('div');
      noMatches.className = 'error';
      noMatches.textContent = 'No matches scheduled';
      content.appendChild(noMatches);
    } else {
      this._matches.forEach(match => {
        content.appendChild(this._renderMatch(match));
      });
    }

    card.appendChild(content);

    // Clear previous content and add new
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);
  }

  _renderMatch(match) {
    const matchElement = document.createElement('div');
    matchElement.className = 'match';

    // Home team
    const homeTeam = document.createElement('div');
    homeTeam.className = 'team team-home';
    homeTeam.innerHTML = `
      <span>${match.home_team}</span>
      ${this._config.show_logos ? `<img class="team-logo" src="${match.home_team_logo}" alt="${match.home_team}">` : ''}
    `;

    // Score
    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = match.status === 'completed' 
      ? `${match.home_score} - ${match.away_score}`
      : 'vs';

    // Away team
    const awayTeam = document.createElement('div');
    awayTeam.className = 'team team-away';
    awayTeam.innerHTML = `
      ${this._config.show_logos ? `<img class="team-logo" src="${match.away_team_logo}" alt="${match.away_team}">` : ''}
      <span>${match.away_team}</span>
    `;

    // Teams container
    const teams = document.createElement('div');
    teams.className = 'teams';
    teams.appendChild(homeTeam);
    teams.appendChild(score);
    teams.appendChild(awayTeam);

    // Match time
    const time = document.createElement('div');
    time.className = 'match-time';
    time.textContent = match.status === 'completed'
      ? 'FT'
      : formatTime(match.time);

    matchElement.appendChild(teams);
    matchElement.appendChild(time);

    return matchElement;
  }
}

// ======================
// Register Custom Element
// ======================
customElements.define('soccer-match-card', SoccerMatchCard);
