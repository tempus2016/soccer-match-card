class SoccerMatchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.teamLogos = {};
    this.logosLoaded = false;
    this.previousHomeTeam = '';
    this.previousAwayTeam = '';
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
    if (!entityId) return;

    const stateObj = this._hass.states[entityId];
    if (!stateObj) return;

    const hasChanged = this.hasEntityChanged(stateObj);
    if (!hasChanged) return;

    const attributes = stateObj.attributes;
    const friendlyName = stateObj.attributes.friendly_name || 'Team';
    const teamName = friendlyName.replace(' Match Info', '').trim();

    if (!this.logosLoaded || !this.teamLogos[teamName]) {
      this.loadTeamLogo(teamName);
    }

    this.render();
  }

  hasEntityChanged(newState) {
    if (!this.previousStateObj) {
      this.previousStateObj = newState;
      return true;
    }

    const prev = this.previousStateObj;
    const curr = newState;

    const changed =
      prev.state !== curr.state ||
      prev.attributes.friendly_name !== curr.attributes.friendly_name ||
      (prev.attributes.home_team !== curr.attributes.home_team) ||
      (prev.attributes.away_team !== curr.attributes.away_team) ||
      (prev.attributes.starttime_datetime !== curr.attributes.starttime_datetime);

    if (changed) {
      this.previousStateObj = curr;
    }

    return changed;
  }

  async loadTeamLogo(teamName) {
    const logo = await this.fetchTeamLogo(teamName);
    this.teamLogos[teamName] = logo;
    this.logosLoaded = true;
    this.render();
  }

  async fetchTeamLogo(teamName) {
    const localLogoPath = `/local/teamlogos/${teamName.toLowerCase().replace(/ /g, '_')}.png`;
    try {
      const response = await fetch(localLogoPath);
      if (response.ok) {
        return localLogoPath;
      }
      throw new Error('Logo not found locally');
    } catch (error) {
      console.log('Logo not found locally, fetching from API...');
      const apiKey = '3'; // Free tier API key
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch team info for ${teamName}`);

        const data = await response.json();
        const team = data.teams ? data.teams[0] : null;

        if (team && team.strBadge) {
          return team.strBadge;
        }
        return '/local/teamlogos/no_image_available.png';
      } catch (error) {
        console.error(`Error fetching logo for ${teamName}:`, error);
        return '/local/teamlogos/no_image_available.png';
      }
    }
  }

  isValidAttribute(attribute) {
    return attribute && attribute.toLowerCase() !== 'unknown' && attribute !== '';
  }

  render() {
    if (!this._hass || !this.config) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="color:white; padding: 16px;">❌ Waiting for hass/config...</div>
        </ha-card>
      `;
      return;
    }

    const entityId = this.config.entity;
    const stateObj = this._hass.states[entityId];

    if (!stateObj) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="color:white; padding: 16px;">❌ Entity not found: ${entityId}</div>
        </ha-card>
      `;
      return;
    }

    const attributes = stateObj.attributes;
    const friendlyName = stateObj.attributes.friendly_name || 'Team';
    const teamName = friendlyName.replace(' Match Info', '').trim();
    const teamLogo = this.teamLogos[teamName] || '/local/teamlogos/no_image_available.png';

    // Check for valid match data
    const hasValidMatch = this.isValidAttribute(attributes.home_team) && 
                         this.isValidAttribute(attributes.away_team) &&
                         attributes.starttime_datetime && 
                         !isNaN(new Date(attributes.starttime_datetime).getTime());

    if (!hasValidMatch) {
      this.shadowRoot.innerHTML = `
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
      this.setNoMatchStyle();
      return;
    }

    // Regular match display
    const homeTeam = attributes.home_team;
    const awayTeam = attributes.away_team;
    const homeTeamLogo = this.teamLogos[homeTeam] || '/local/teamlogos/no_image_available.png';
    const awayTeamLogo = this.teamLogos[awayTeam] || '/local/teamlogos/no_image_available.png';
    const league = attributes.league || '';
    const location = attributes.location || '';
    const startDatetime = new Date(attributes.starttime_datetime);
    const endDatetime = new Date(attributes.endtime_datetime);
    const now = new Date();

    // Match status calculation
    const isInPlay = now >= startDatetime && now <= endDatetime;
    const matchDate = startDatetime.toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString();

    let matchStatus = '';
    if (isInPlay) {
      matchStatus = `<span class="status-line start-time">In Play</span>`;
    } else if (matchDate === today) {
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>Today</p></span>`;
    } else if (matchDate === tomorrow) {
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>Tomorrow</p></span>`;
    } else {
      const day = startDatetime.getDate();
      const month = startDatetime.toLocaleDateString('en-US', { month: 'long' });
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>${day} ${month}</p></span>`;
    }

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="match-container">
          <div class="header">${league}</div>
          <div class="teams-row">
            <div class="team">
              <img src="${homeTeamLogo}" alt="${homeTeam} Logo" class="team-logo">
              <div class="team-name">${homeTeam}</div>
            </div>
            <div class="vs-container">
              <div class="kickoff-time">${matchStatus}</div>
            </div>
            <div class="team">
              <img src="${awayTeamLogo}" alt="${awayTeam} Logo" class="team-logo">
              <div class="team-name">${awayTeam}</div>
            </div>
          </div>
          <div class="location">${location}</div>
        </div>
      </ha-card>
    `;
    this.setMatchStyle();
  }

  setNoMatchStyle() {
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        border-radius: 12px;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
      }
      .no-match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 20px;
        text-align: center;
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
        margin-top: 10px;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  setMatchStyle() {
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
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
    this.shadowRoot.appendChild(style);
  }
}

customElements.define('soccer-match-card', SoccerMatchCard);
