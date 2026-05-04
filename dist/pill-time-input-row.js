const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class CustomSelectRow extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {}, 
      _unlocked: { type: Boolean }, 
      _errorId: { type: String }
    };
  }

  constructor() {
    super();
    this._unlocked = false;
    this._errorId = null;
  }

  render() {
    const { entity, entity2, name, icon, header, header2, suffix, locked } = this.config;
    const stateObj = this.hass.states[entity];
    if (!stateObj) {
      return html`<hui-warning>Entity ${entity} does not exist.</hui-warning>`;
    }

    const domain = entity.split(".")[0];
    if (domain !== "input_datetime") {
      return html`<hui-warning>Entity ${entity} is not an input_datetime.</hui-warning>`;
    }

    if (entity2) {
      const stateObj2 = this.hass.states[entity2];
      if (!stateObj2) {
      return html`<hui-warning>Entity ${entity2} does not exist.</hui-warning>`;
      }
      const domain2 = entity2.split(".")[0];
      if (domain2 !== "input_datetime") {
        return html`<hui-warning>Entity ${entity2} is not an input_datetime.</hui-warning>`;
      }
    }

    const isLocked = locked && !this._unlocked;

    return html`
      <div class="container">
        <state-badge .hass=${this.hass} .stateObj=${stateObj} .overrideIcon=${icon} @click=${() => this._info(entity)} class="pointer"></state-badge>
        <div class="info pointer" @click=${() => this._info(entity)}>${name || stateObj.attributes.friendly_name}</div>
        <div class="selection-wrapper">
          ${locked ? html`<ha-icon icon="${isLocked ? 'mdi:lock' : 'mdi:lock-open-variant'}" class="lock-toggle ${isLocked ? 'is-locked' : 'is-unlocked'}" @click=${() => this._unlocked = !this._unlocked}></ha-icon>` : ""}
          <div class="times-group">
            ${this._renderPill(entity, header, "1", isLocked)}
            ${entity2 ? this._renderPill(entity2, header2, "2", isLocked) : ""}
          </div>
          ${suffix ? html`<span class="suffix">${suffix}</span>` : ""}
        </div>
      </div>`;
  }

  _renderPill(entId, header, id, isLocked) {
    const parts = (this.hass.states[entId]?.state || "00:00").split(":");
    return html`
      <div class="time-outer">
        <div class="header ${header ? 'visible' : ''}">${header}</div>
        <div class="pill-container ${isLocked ? 'disabled' : ''}">
          <input type="text" inputmode=numeric class="value-input" ?readonly=${isLocked} 
              .value="${parts[0]}" 
              @input=${(e) => this._val(e, 23, id)} 
              @change=${(e) => this._set(e, entId, 'h', id)} 
              @wheel=${(e) => this._wheel(e, entId, 'h')}>
          <div class="sep">:</div>
          <input type="text" inputmode=numeric class="value-input" ?readonly=${isLocked} 
              .value="${parts[1]}" 
              @input=${(e) => this._val(e, 59, id)} 
              @change=${(e) => this._set(e, entId, 'm', id)} 
              @wheel=${(e) => this._wheel(e, entId, 'm')}>
        </div>
        <div class="error-msg ${this._errorId === id ? 'visible' : ''}">Invalid</div>
      </div>`;
  }

  _wheel(e, entId, type) {
    if (this.config.locked && !this._unlocked) return;
    e.preventDefault();
    let parts = this.hass.states[entId].state.split(":").map(Number);
    const amt = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1);
    if (type === 'h') parts[0] = (parts[0] + amt + 24) % 24;
    else parts[1] = (parts[1] + amt + 60) % 60;
    this._svc(entId, parts[0], parts[1]);
  }

  _set(e, entId, type, id) {
    const val = parseInt(e.target.value);
    const limit = type === 'h' ? 23 : 59;
    let parts = this.hass.states[entId].state.split(":").map(Number);
    if (isNaN(val) || val < 0 || val > limit) {
      e.target.value = type === 'h' ? String(parts[0]).padStart(2, '0') : String(parts[1]).padStart(2, '0');
      this._err(id);
    } else {
      type === 'h' ? parts[0] = val : parts[1] = val;
      this._svc(entId, parts[0], parts[1]);
    }
  }

  _svc(entId, h, m) {
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    this.hass.callService("input_datetime", "set_datetime", { entity_id: entId, time });
  }

  _val(e, limit, id) {
    const v = parseInt(e.target.value);
    if (e.target.value !== "" && (isNaN(v) || v < 0 || v > limit)) this._err(id);
  }

  _err(id) {
    this._errorId = id;
    clearTimeout(this._t);
    this._t = setTimeout(() => this._errorId = null, 3000);
  }

  _info(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  setConfig(config) { this.config = config; }

  static get styles() {
    return css`
      .container { display: flex; align-items: center; padding: 4px 0; }
      .info { margin-left: 16px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pointer { cursor: pointer; }
      .selection-wrapper { display: flex; align-items: center; }
      .times-group { display: flex; gap: 6px; }
      .time-outer { display: flex; flex-direction: column; align-items: center; position: relative; }
      .header { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); opacity: 0; }
      .header.visible { opacity: 1; }
      .pill-container { display: flex; background: var(--secondary-background-color); border-radius: 10px; padding: 2px 6px; }
      .value-input { width: 2.2ch; border: none; background: none; text-align: center; color: var(--primary-text-color); font-size: 14px; padding: 0; outline: none; }
      .sep { font-weight: bold; color: var(--secondary-text-color); }
      .error-msg { position: absolute; bottom: -14px; font-size: 9px; color: var(--error-color); opacity: 0; transition: 0.3s; pointer-events: none; }
      .error-msg.visible { opacity: 1; }
      .lock-toggle { --mdc-icon-size: 20px; margin-right: 8px; cursor: pointer; }
      .is-locked { color: var(--warning-color); }
      .is-unlocked { color: var(--success-color); }
      .disabled { opacity: 0.5; pointer-events: none; }
      .suffix { margin-left: 8px; color: var(--secondary-text-color); font-size: 12px; }
    `;
  }
}
customElements.define("pill-time-input-row", CustomSelectRow);
