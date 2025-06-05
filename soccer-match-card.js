import { LitElement, html, css } from 'lit';

class SoccerMatchCard extends LitElement {
  static properties = {
    hass: { type: Object },
    config: { type: Object },
    _stateObj: { type: Object },
    _teamLogos: { type: Object },
    _loadingLogos: { type: Object },
    _failedLogos: { type: Object },
    _timestamp: { type: Number }
  };

  static styles = css`
    ha-card {
      border-radius: 12px;
      background: linear-gradient(to bottom, #002147 0%, #004080 100%);
      color: #fff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      padding: 16px;
    }
    .team-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
    }
    .match-container, .no-match-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .teams-row {
      display: flex;
      justify-content: space-around;
      width: 100%;
      margin: 16px 0;
    }
    .team {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .team-name {
      font-size: 18px;
      margin-top: 8px;
    }
    .status-line {
      font-size: 20px;
      font-weight: bold;
      margin-top: 8px;
    }
    .location {
      font-size: 14px;
      color: #ccc;
    }
    .header {
      background: #d71920;
      padding: 8px;
      font-weight: bold;
      font-size: 18px;
      width: 100%;
    }
  `;

  constructor() {
    super();
    this._teamLogos = {};
    this._loadingLogos = new Set();
    this._failedLogos = new Set();
    this._timestamp = Date.now();
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
  }

  set hass(hass) {
    const stateObj = hass.states[this.config.entity];
    const prev = this._stateObj;
    this._stateObj = stateObj;
    this._timestamp = Date.now();
    this.hass = hass;

    if (!stateObj || stateObj === prev) return;

    const teamNames = this._getAllTeamNames(stateObj);
    for (const team of teamNames) {
      if (!this._teamLogos[team] && !this._loadingLogos.has(team) && !this._failedLogos.has(team)) {
        this._fetchTeamLogo(team);
      }
    }
  }

  _getAllTeamNames(stateObj) {
    const { home_team, away_team, friendly_name } = stateObj?.attributes || {};
    const teamName = this._extractTeamName(friendly_name);
    return [home_team, away_team, teamName].filter(Boolean);
  }

  _extractTeamName(friendlyName = '') {
    return friendlyName.replace(' FC Match Info', '').trim();
  }

  async _fetchTeamLogo(team) {
    this._loadingLogos.add(team);
    const localPath = this._localLogoPath(team);
    try {
      const res = await fetch(`${localPath}?ts=${this._timestamp}`);
      if (res.ok) {
        this._teamLogos[team] = localPath;
        this.requestUpdate();
        return;
      }
    } catch (_) {}

    try {
      const apiKey = '3';
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(team)}`);
      const data = await res.json();
      const badge = data.teams?.[0]?.strBadge;

      if (badge) {
        const filename = `${team.toLowerCase().replace(/ /g, '_')}.png`;
        await this.hass.callService('downloader', 'download_file', {
          overwrite: true,
          url: badge,
          filename
        });
        this._teamLogos[team] = `/local/teamlogos/${filename}`;
      } else {
        this._failedLogos.add(team);
      }
    } catch (e) {
      console.warn(`Logo fetch failed for ${team}`, e);
      this._failedLogos.add(team);
    }
    this._loadingLogos.delete(team);
    this.requestUpdate();
  }

  _localLogoPath(team) {
    return `/local/teamlogos/${team.toLowerCase().replace(/ /g, '_')}.png`;
  }

  _isValid(attr) {
    return attr && attr !== 'unknown';
  }

  _getMatchStatus(start, end) {
    const now = new Date();
    if (now >= start && now <= end) return html`<div class="status-line">In Play</div>`;
    const sameDay = start.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const time = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return html`<div class="status-line">${time} Today</div>`;
    if (start.toDateString() === tomorrow.toDateString()) return html`<div class="status-line">${time} Tomorrow</div>`;
    return html`<div class="status-line">${time} ${start.toLocaleDateString()}`;
  }

  render() {
    const stateObj = this._stateObj;
    if (!stateObj) return html`<ha-card>❌ Entity not found</ha-card>`;

    const attr = stateObj.attributes;
    const type = this._isValid(attr.home_team) && this._isValid(attr.away_team) && attr.starttime_datetime ? 'match' : 'no-match';
    const fallback = '/local/teamlogos/no_image_available.png';

    if (type === 'no-match') {
      const team = this._extractTeamName(attr.friendly_name);
      const logo = this._teamLogos[team] || fallback;
      return html`
        <ha-card>
          <div class="no-match-container">
            <img class="team-logo" src="${logo}?ts=${this._timestamp}" />
            <div>No Upcoming Matches</div>
          </div>
        </ha-card>
      `;
    }

    const { home_team, away_team, starttime_datetime, endtime_datetime, league, location } = attr;
    const homeLogo = this._teamLogos[home_team] || fallback;
    const awayLogo = this._teamLogos[away_team] || fallback;
    const start = new Date(starttime_datetime);
    const end = new Date(endtime_datetime);

    return html`
      <ha-card>
        <div class="match-container">
          <div class="header">${league}</div>
          <div class="teams-row">
            <div class="team">
              <img class="team-logo" src="${homeLogo}?ts=${this._timestamp}" />
              <div class="team-name">${home_team}</div>
            </div>
            <div class="team">
              ${this._getMatchStatus(start, end)}
            </div>
            <div class="team">
              <img class="team-logo" src="${awayLogo}?ts=${this._timestamp}" />
              <div class="team-name">${away_team}</div>
            </div>
          </div>
          <div class="location">${location}</div>
        </div>
      </ha-card>
    `;
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('soccer-match-card', SoccerMatchCard);
