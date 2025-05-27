class SoccerMatchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.teamLogos = {};
    this.loadingLogos = new Set();
    this.failedLogos = new Set();
    this.previousStateObj = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;

    const entityId = this.config.entity;
    const stateObj = this._hass.states[entityId];
    if (!stateObj || !this.hasEntityChanged(stateObj)) return;

    const teamName = this.extractTeamName(stateObj.attributes.friendly_name);
    if (!this.teamLogos[teamName] && !this.loadingLogos.has(teamName) && !this.failedLogos.has(teamName)) {
      this.loadTeamLogo(teamName);
    }

    this.render();
  }

  hasEntityChanged(newState) {
    const prev = this.previousStateObj;
    this.previousStateObj = newState;

    if (!prev) return true;

    const attrsChanged = ['home_team', 'away_team', 'starttime_datetime'].some(
      key => prev.attributes[key] !== newState.attributes[key]
    );

    return prev.state !== newState.state ||
           prev.attributes.friendly_name !== newState.attributes.friendly_name ||
           attrsChanged;
  }

  extractTeamName(friendlyName = '') {
    return friendlyName.replace(' FC Match Info', '').trim();
  }

  async loadTeamLogo(teamName) {
    this.loadingLogos.add(teamName);
    const logo = await this.fetchTeamLogo(teamName);
    this.loadingLogos.delete(teamName);

    if (logo) {
      this.teamLogos[teamName] = logo;
    } else {
      this.failedLogos.add(teamName);
    }

    this.render();
    setTimeout(() => this.refreshLogos(), 100);
  }

  async fetchTeamLogo(teamName) {
    const logoPath = this.getLocalLogoPath(teamName);
    const cacheBuster = Date.now();

    try {
      const response = await fetch(`${logoPath}?ts=${cacheBuster}`);
      if (response.ok) return logoPath;
      throw new Error('Local logo missing');
    } catch {
      try {
        const apiKey = '3';
        const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`;
        const response = await fetch(url);
        const data = await response.json();
        const team = data.teams?.[0];

        if (team?.strBadge) {
          const badgeUrl = team.strBadge;
          const filename = `${teamName.toLowerCase().replace(/ /g, '_')}.png`;
          await this._hass.callService('downloader', 'download_file', {
            overwrite: true,
            url: badgeUrl,
            filename: `teamlogos/${filename}`,
          });
          return `/local/teamlogos/${filename}`;
        }
      } catch (error) {
        console.error(`Failed to fetch logo for ${teamName}:`, error);
      }
    }

    return '/local/teamlogos/no_image_available.png';
  }

  getLocalLogoPath(teamName) {
    return `/local/teamlogos/${teamName.toLowerCase().replace(/ /g, '_')}.png`;
  }

  refreshLogos() {
    const images = this.shadowRoot.querySelectorAll('img.team-logo');
    images.forEach(img => {
      const baseSrc = img.src.split('?')[0];
      img.src = `${baseSrc}?ts=${Date.now()}`;
    });
  }

  isValidAttribute(attr) {
    return attr && attr.toLowerCase() !== 'unknown' && attr !== '';
  }

  render() {
    if (!this._hass || !this.config) {
      this.shadowRoot.innerHTML = `<ha-card><div style="color:white; padding: 16px;">❌ Waiting for hass/config...</div></ha-card>`;
      return;
    }

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div style="color:white; padding: 16px;">❌ Entity not found: ${this.config.entity}</div></ha-card>`;
      return;
    }

    const html = this.buildTemplate(stateObj);
    this.shadowRoot.innerHTML = html;
    this.applyStyle(this.getTemplateType(stateObj));
  }

  getTemplateType(stateObj) {
    const attr = stateObj.attributes;
    return this.isValidAttribute(attr.home_team) &&
           this.isValidAttribute(attr.away_team) &&
           attr.starttime_datetime &&
           !isNaN(new Date(attr.starttime_datetime).getTime())
      ? 'match'
      : 'no-match';
  }

  buildTemplate(stateObj) {
    const attr = stateObj.attributes;
    const now = new Date();
    const timestamp = Date.now();
    const friendlyName = attr.friendly_name || 'Team';
    const teamName = this.extractTeamName(friendlyName);
    const teamLogo = `${(this.teamLogos[teamName] || '/local/teamlogos/no_image_available.png')}?ts=${timestamp}`;

    if (this.getTemplateType(stateObj) === 'no-match') {
      return `
        <ha-card>
          <div class="no-match-container">
            <div class="team-logo-container">
              <img src="${teamLogo}" alt="${teamName} Logo" class="team-logo">
              <div class="team-name">${teamName}</div>
            </div>
            <div class="no-matches-message">No Upcoming Matches</div>
          </div>
        </ha-card>
      `;
    }

    const home = attr.home_team;
    const away = attr.away_team;
    const league = attr.league || '';
    const location = attr.location || '';
    const start = new Date(attr.starttime_datetime);
    const end = new Date(attr.endtime_datetime);
    const homeLogo = `${(this.teamLogos[home] || '/local/teamlogos/no_image_available.png')}?ts=${timestamp}`;
    const awayLogo = `${(this.teamLogos[away] || '/local/teamlogos/no_image_available.png')}?ts=${timestamp}`;

    const isInPlay = now >= start && now <= end;
    const matchDate = start.toLocaleDateString();
    const today = now.toLocaleDateString();
    const tomorrow = new Date(now.getTime() + 86400000).toLocaleDateString();

    let matchStatus;
    const matchTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isInPlay) {
      matchStatus = `<span class="status-line start-time">In Play</span>`;
    } else if (matchDate === today) {
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>Today</p></span>`;
    } else if (matchDate === tomorrow) {
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>Tomorrow</p></span>`;
    } else {
      const day = start.getDate();
      const month = start.toLocaleDateString('en-US', { month: 'long' });
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>${day} ${month}</p></span>`;
    }

    return `
      <ha-card>
        <div class="match-container">
          <div class="header">${league}</div>
          <div class="teams-row">
            <div class="team">
              <img src="${homeLogo}" alt="${home} Logo" class="team-logo">
              <div class="team-name">${home}</div>
            </div>
            <div class="vs-container">
              <div class="kickoff-time">${matchStatus}</div>
            </div>
            <div class="team">
              <img src="${awayLogo}" alt="${away} Logo" class="team-logo">
              <div class="team-name">${away}</div>
            </div>
          </div>
          <div class="location">${location}</div>
        </div>
      </ha-card>
    `;
  }

  applyStyle(type = 'match') {
    const style = document.createElement('style');
    style.textContent = this.getStyles(type);
    this.shadowRoot.appendChild(style);
  }

  getStyles(type) {
    const common = `
      ha-card {
        border-radius: 12px;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
    `;

    const noMatch = `
      .no-match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 20px;
        text-align: center;
        height: 200px;
        justify-content: center;
      }
      .team-logo-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 20px;
      }
      .team-logo {
        width: 100px;
        height: 100px;
        object-fit: contain;
      }
      .team-name {
        font-size: 22px;
        font-weight: bold;
        margin-top: 10px;
      }
      .no-matches-message {
        font-size: 18px;
        color: #ccc;
      }
    `;

    const match = `
      .match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
      }
      .header {
        width: 100%;
        text-align: center;
        background-color: #d71920;
        color: #fff;
        font-size: 18px;
        font-weight: bold;
        padding: 8px 0;
        letter-spacing: 1px;
      }
      .teams-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin: 16px 0;
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
        margin-bottom: 8px;
        object-fit: contain;
      }
      .team-name {
        font-size: 20px;
        text-align: center;
      }
      .vs-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 0.6;
        color: #fff;
      }
      .kickoff-time {
        font-size: 14px;
        text-align: center;
      }
      .status-line {
        display: block;
        text-align: center;
        font-size: 14px;
        font-weight: bold;
      }
      .status-line p {
        font-size: 16px;
        line-height: 0px;
        color: #ccc;
        padding-top: 12px;
      }
      .start-time {
        font-size: 30px;
        height: 22px;
      }
      .location {
        font-size: 14px;
        color: #ddd;
        text-align: center;
      }
    `;

    return common + (type === 'match' ? match : noMatch);
  }
}

customElements.define('soccer-match-card', SoccerMatchCard);
