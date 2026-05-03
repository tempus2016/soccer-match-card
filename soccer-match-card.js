// --- Editor ---
class SoccerMatchCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;

    if (!this._rendered) {
      this.innerHTML = `<ha-entity-picker allow-custom-entity></ha-entity-picker>`;
      this._picker = this.querySelector("ha-entity-picker");
      this._picker.addEventListener("value-changed", (ev) => {
        const value = ev.detail.value;
        if (this._config.entity === value) return;
        this._config = { ...this._config, entity: value };
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: this._config },
          })
        );
      });
      this._rendered = true;
    }

    this._picker.hass = this._hass;
    this._picker.value = this._config.entity || "";
    this._picker.label = "Entity (Team Tracker sensor)";
    this._picker.includeDomains = ["sensor"];
  }
}

customElements.define("soccer-match-card-editor", SoccerMatchCardEditor);

// --- Main Card ---
class SoccerMatchCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("soccer-match-card-editor");
  }

  static getStubConfig() {
    return { entity: "" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._logos = {};
    this._loadingLogos = new Set();
    this._failedLogos = new Set();
    this._currentView = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }
    this.config = { ...config };
    if (this._hass) this._update();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.config) return;

    const oldState = prev?.states[this.config.entity];
    const newState = hass.states[this.config.entity];
    if (oldState === newState && this._currentView) return;

    this._update();
  }

  getCardSize() {
    return 3;
  }

  // --- Logo resolution ---

  _getHomeLogo(stateObj) {
    const attr = stateObj.attributes;
    if (attr.team_homeaway === "home" && attr.team_logo) return attr.team_logo;
    if (attr.team_homeaway === "away" && attr.opponent_logo) return attr.opponent_logo;
    if (attr.home_team && this._logos[attr.home_team]) return this._logos[attr.home_team];
    return "/local/teamlogos/no_image_available.png";
  }

  _getAwayLogo(stateObj) {
    const attr = stateObj.attributes;
    if (attr.team_homeaway === "away" && attr.team_logo) return attr.team_logo;
    if (attr.team_homeaway === "home" && attr.opponent_logo) return attr.opponent_logo;
    if (attr.away_team && this._logos[attr.away_team]) return this._logos[attr.away_team];
    return "/local/teamlogos/no_image_available.png";
  }

  _getTeamLogo(stateObj) {
    const attr = stateObj.attributes;
    if (attr.team_logo) return attr.team_logo;
    const teamName = attr.team_name || this._extractTeamName(attr.friendly_name);
    if (teamName && this._logos[teamName]) return this._logos[teamName];
    return "/local/teamlogos/no_image_available.png";
  }

  _extractTeamName(friendlyName) {
    if (!friendlyName) return "";
    return friendlyName.replace(/\s*(FC\s+)?Match\s+Info$/i, "").trim();
  }

  _loadLogosIfNeeded(stateObj) {
    const attr = stateObj.attributes;
    if (attr.team_logo && attr.opponent_logo) return;

    const teams = new Set();
    if (attr.home_team && this._isValidAttr(attr.home_team)) teams.add(attr.home_team);
    if (attr.away_team && this._isValidAttr(attr.away_team)) teams.add(attr.away_team);
    const teamName = attr.team_name || this._extractTeamName(attr.friendly_name);
    if (teamName && this._isValidAttr(teamName)) teams.add(teamName);

    for (const team of teams) {
      if (this._logos[team] || this._loadingLogos.has(team) || this._failedLogos.has(team)) continue;
      this._loadTeamLogo(team);
    }
  }

  async _loadTeamLogo(teamName) {
    this._loadingLogos.add(teamName);

    const localPath = `/local/teamlogos/${teamName.toLowerCase().replace(/ /g, "_")}.png`;
    try {
      const resp = await fetch(`${localPath}?ts=${Date.now()}`);
      if (resp.ok) {
        this._loadingLogos.delete(teamName);
        this._logos[teamName] = localPath;
        this._update();
        return;
      }
    } catch { /* continue to API */ }

    try {
      const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
      const resp = await fetch(url);
      const data = await resp.json();
      const team = data.teams?.[0];
      if (team?.strBadge) {
        this._loadingLogos.delete(teamName);
        this._logos[teamName] = team.strBadge;
        this._update();
        return;
      }
    } catch (err) {
      console.error(`Failed to fetch logo for ${teamName}:`, err);
    }

    this._loadingLogos.delete(teamName);
    this._failedLogos.add(teamName);
  }

  // --- Score resolution ---

  _getScores(stateObj) {
    const attr = stateObj.attributes;
    if (attr.team_homeaway === "home") {
      return { home: attr.team_score ?? "", away: attr.opponent_score ?? "" };
    }
    if (attr.team_homeaway === "away") {
      return { home: attr.opponent_score ?? "", away: attr.team_score ?? "" };
    }
    return { home: "", away: "" };
  }

  // --- Helpers ---

  _isSameDay(d1, d2) {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  _isValidAttr(val) {
    return val && val.toLowerCase() !== "unknown" && val !== "";
  }

  _hasValidMatch(stateObj) {
    const attr = stateObj.attributes;
    return (
      ["PRE", "IN", "POST"].includes(stateObj.state) &&
      this._isValidAttr(attr.home_team) &&
      this._isValidAttr(attr.away_team)
    );
  }

  // --- Update & render ---

  _update() {
    if (!this._hass || !this.config) return;

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this._showError(`Entity not found: ${this.config.entity}`);
      return;
    }

    this._loadLogosIfNeeded(stateObj);

    if (this._hasValidMatch(stateObj)) {
      this._renderMatch(stateObj);
    } else {
      this._renderNoMatch(stateObj);
    }
  }

  _showError(message) {
    if (this._currentView === "error") {
      const el = this.shadowRoot.getElementById("error-msg");
      if (el) { el.textContent = message; return; }
    }
    this._currentView = "error";
    this.shadowRoot.innerHTML = `
      <style>${this._getBaseStyles()}</style>
      <ha-card><div class="error" id="error-msg">${message}</div></ha-card>
    `;
  }

  _renderNoMatch(stateObj) {
    const attr = stateObj.attributes;
    const teamName = attr.team_name || this._extractTeamName(attr.friendly_name) || "Team";
    const logo = this._getTeamLogo(stateObj);
    const state = stateObj.state;

    let message = "No Upcoming Matches";
    if (state === "BYE") message = "Bye Week";
    if (state === "NOT_FOUND") message = "Team Not Found";

    if (this._currentView === "no-match") {
      const logoEl = this.shadowRoot.getElementById("nm-logo");
      const msgEl = this.shadowRoot.getElementById("nm-message");
      if (logoEl) { logoEl.src = logo; logoEl.alt = teamName; }
      if (msgEl) msgEl.textContent = message;
      return;
    }

    this._currentView = "no-match";
    this.shadowRoot.innerHTML = `
      <style>${this._getBaseStyles()}${this._getNoMatchStyles()}</style>
      <ha-card>
        <div class="no-match-container">
          <img id="nm-logo" src="${logo}" alt="${teamName}" class="team-logo-large" />
          <div id="nm-message" class="no-matches-message">${message}</div>
        </div>
      </ha-card>
    `;
  }

  _renderMatch(stateObj) {
    const attr = stateObj.attributes;
    const state = stateObj.state;
    const home = attr.home_team;
    const away = attr.away_team;
    const league = attr.league || "";
    const location = attr.location || "";
    const homeLogo = this._getHomeLogo(stateObj);
    const awayLogo = this._getAwayLogo(stateObj);
    const statusHTML = this._buildStatusHTML(state, stateObj);

    if (this._currentView === "match") {
      const el = (id) => this.shadowRoot.getElementById(id);
      const headerEl = el("m-header");
      const homeLogoEl = el("m-home-logo");
      const homeNameEl = el("m-home-name");
      const awayLogoEl = el("m-away-logo");
      const awayNameEl = el("m-away-name");
      const statusEl = el("m-status");
      const locationEl = el("m-location");

      if (headerEl) { headerEl.textContent = league; headerEl.style.display = league ? "" : "none"; }
      if (homeLogoEl) { homeLogoEl.src = homeLogo; homeLogoEl.alt = home; }
      if (homeNameEl) homeNameEl.textContent = home;
      if (awayLogoEl) { awayLogoEl.src = awayLogo; awayLogoEl.alt = away; }
      if (awayNameEl) awayNameEl.textContent = away;
      if (statusEl) statusEl.innerHTML = statusHTML;
      if (locationEl) { locationEl.textContent = location; locationEl.style.display = location ? "" : "none"; }
      return;
    }

    this._currentView = "match";
    this.shadowRoot.innerHTML = `
      <style>${this._getBaseStyles()}${this._getMatchStyles()}</style>
      <ha-card>
        <div class="match-container">
          <div id="m-header" class="header" style="${league ? "" : "display:none"}">${league}</div>
          <div class="teams-row">
            <div class="team">
              <img id="m-home-logo" src="${homeLogo}" alt="${home}" class="team-logo" />
              <div id="m-home-name" class="team-name">${home}</div>
            </div>
            <div class="vs-container">
              <div id="m-status">${statusHTML}</div>
            </div>
            <div class="team">
              <img id="m-away-logo" src="${awayLogo}" alt="${away}" class="team-logo" />
              <div id="m-away-name" class="team-name">${away}</div>
            </div>
          </div>
          <div id="m-location" class="location" style="${location ? "" : "display:none"}">${location}</div>
        </div>
      </ha-card>
    `;
  }

  _buildStatusHTML(state, stateObj) {
    if (state === "IN") {
      const scores = this._getScores(stateObj);
      return `
        <div class="score">${scores.home} - ${scores.away}</div>
        <div class="status-label live">LIVE</div>
      `;
    }

    if (state === "POST") {
      const scores = this._getScores(stateObj);
      return `
        <div class="score">${scores.home} - ${scores.away}</div>
        <div class="status-label">FT</div>
      `;
    }

    const attr = stateObj.attributes;
    const start = new Date(attr.starttime_datetime);
    if (isNaN(start.getTime())) {
      return `<div class="kickoff-label">TBD</div>`;
    }

    const time = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let label;
    if (this._isSameDay(start, now)) {
      label = "Today";
    } else if (this._isSameDay(start, tomorrow)) {
      label = "Tomorrow";
    } else {
      const day = start.getDate();
      const month = start.toLocaleDateString("en-GB", { month: "long" });
      label = `${day} ${month}`;
    }

    return `
      <div class="kickoff-time">${time}</div>
      <div class="kickoff-label">${label}</div>
    `;
  }

  // --- Styles ---

  _getBaseStyles() {
    return `
      ha-card {
        border-radius: 12px;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        overflow: hidden;
      }
      .error {
        padding: 16px;
        color: #fff;
      }
    `;
  }

  _getNoMatchStyles() {
    return `
      .no-match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 24px 16px;
        min-height: 180px;
      }
      .team-logo-large {
        width: 100px;
        height: 100px;
        object-fit: contain;
        margin-bottom: 16px;
      }
      .no-matches-message {
        font-size: 18px;
        color: #ccc;
      }
    `;
  }

  _getMatchStyles() {
    return `
      .match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .header {
        width: 100%;
        text-align: center;
        background-color: #d71920;
        color: #fff;
        font-size: 16px;
        font-weight: bold;
        padding: 8px 0;
        letter-spacing: 1px;
      }
      .teams-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        padding: 16px;
        box-sizing: border-box;
      }
      .team {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
      }
      .team-logo {
        width: 80px;
        height: 80px;
        object-fit: contain;
        margin-bottom: 8px;
      }
      .team-name {
        font-size: 14px;
        text-align: center;
        font-weight: 500;
      }
      .vs-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 0.8;
      }
      .score {
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 2px;
      }
      .status-label {
        font-size: 13px;
        font-weight: bold;
        color: #ccc;
        margin-top: 4px;
        text-transform: uppercase;
      }
      .status-label.live {
        color: #4caf50;
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .kickoff-time {
        font-size: 28px;
        font-weight: bold;
      }
      .kickoff-label {
        font-size: 14px;
        color: #ccc;
        margin-top: 4px;
      }
      .location {
        font-size: 13px;
        color: #ddd;
        text-align: center;
        padding: 0 16px 12px;
      }
    `;
  }
}

customElements.define("soccer-match-card", SoccerMatchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "soccer-match-card",
  name: "Soccer Match Card",
  description: "Displays soccer match information from Team Tracker sensors",
});
