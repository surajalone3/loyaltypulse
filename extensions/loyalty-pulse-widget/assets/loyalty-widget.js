(function () {
  const API_PATH = "/apps/loyaltypulse/loyalty";

  const TIER_LABELS = {
    BRONZE: "Bronze",
    SILVER: "Silver",
    GOLD: "Gold",
  };

  function formatCount(value) {
    return Number(value ?? 0).toLocaleString();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tierClass(tier) {
    const key = String(tier ?? "BRONZE").toLowerCase();
    return `lpw-tier-badge lpw-tier-badge--${key}`;
  }

  function logoSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z"/></svg>`;
  }

  function renderGuest(root, data) {
    const heading = root.dataset.heading || "Your Loyalty Rewards";
    const message =
      data.message || root.dataset.loginMessage || "Log in to view your rewards.";
    const loginUrl = root.dataset.loginUrl || "/account/login";

    root.innerHTML = `
      <div class="lpw-card">
        <div class="lpw-header">
          <div class="lpw-logo">${logoSvg()}</div>
          <div class="lpw-header-text">
            <h2>${escapeHtml(heading)}</h2>
            <p>LoyaltyPulse</p>
          </div>
        </div>
        <div class="lpw-body">
          <p class="lpw-message">${escapeHtml(message)}</p>
          <div style="text-align:center">
            <a class="lpw-guest-cta" href="${escapeHtml(loginUrl)}">Log in</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderUnavailable(root, data) {
    root.innerHTML = `
      <div class="lpw-card">
        <div class="lpw-header">
          <div class="lpw-logo">${logoSvg()}</div>
          <div class="lpw-header-text">
            <h2>LoyaltyPulse</h2>
            <p>Rewards program</p>
          </div>
        </div>
        <div class="lpw-body">
          <p class="lpw-message">${escapeHtml(data.message || "Loyalty program unavailable.")}</p>
        </div>
      </div>
    `;
  }

  function renderReward(reward, pointsName) {
    const progress = Math.min(
      100,
      reward.pointsRequired > 0
        ? Math.round(
            ((reward.pointsRequired - reward.pointsNeeded) / reward.pointsRequired) * 100
          )
        : 100
    );

    const status = reward.canRedeem
      ? `<span class="lpw-reward-status lpw-reward-status--ready">Ready to redeem</span>`
      : `<span class="lpw-reward-status lpw-reward-status--locked">${formatCount(reward.pointsNeeded)} more ${escapeHtml(pointsName)} needed</span>`;

    const description = reward.description
      ? `<p class="lpw-reward-desc">${escapeHtml(reward.description)}</p>`
      : "";

    return `
      <article class="lpw-reward">
        <div class="lpw-reward-top">
          <h4 class="lpw-reward-name">${escapeHtml(reward.name)}</h4>
          <span class="lpw-reward-points">${formatCount(reward.pointsRequired)} pts</span>
        </div>
        ${description}
        <div class="lpw-reward-footer">
          ${status}
          <div class="lpw-progress" aria-hidden="true">
            <div class="lpw-progress-bar" style="width:${progress}%"></div>
          </div>
        </div>
      </article>
    `;
  }

  function renderEnrolled(root, data) {
    const heading = root.dataset.heading || "Your Loyalty Rewards";
    const pointsName = data.pointsName || "points";
    const tierLabel = TIER_LABELS[data.tier] || data.tier || "Bronze";
    const rewards = Array.isArray(data.rewards) ? data.rewards : [];

    const rewardsHtml =
      rewards.length > 0
        ? `<div class="lpw-rewards">${rewards.map((r) => renderReward(r, pointsName)).join("")}</div>`
        : `<p class="lpw-empty">No rewards available yet. Check back soon!</p>`;

    const inactiveNote = data.programActive
      ? ""
      : `<p class="lpw-message" style="margin-bottom:14px">The loyalty program is currently paused. Your balance is shown below.</p>`;

    root.innerHTML = `
      <div class="lpw-card">
        <div class="lpw-header">
          <div class="lpw-logo">${logoSvg()}</div>
          <div class="lpw-header-text">
            <h2>${escapeHtml(heading)}</h2>
            <p>Powered by LoyaltyPulse</p>
          </div>
        </div>
        <div class="lpw-body">
          ${inactiveNote}
          <div class="lpw-stats">
            <div class="lpw-stat">
              <span class="lpw-stat-label">Your ${escapeHtml(pointsName)}</span>
              <span class="lpw-stat-value lpw-stat-value--accent">${formatCount(data.pointsBalance)}</span>
            </div>
            <div class="lpw-stat">
              <span class="lpw-stat-label">Your tier</span>
              <span class="${tierClass(data.tier)}">${escapeHtml(tierLabel)}</span>
            </div>
          </div>
          <h3 class="lpw-section-title">Available rewards</h3>
          ${rewardsHtml}
        </div>
      </div>
    `;
  }

  function renderLoggedInNotEnrolled(root, data) {
    const heading = root.dataset.heading || "Your Loyalty Rewards";

    root.innerHTML = `
      <div class="lpw-card">
        <div class="lpw-header">
          <div class="lpw-logo">${logoSvg()}</div>
          <div class="lpw-header-text">
            <h2>${escapeHtml(heading)}</h2>
            <p>LoyaltyPulse</p>
          </div>
        </div>
        <div class="lpw-body">
          <p class="lpw-message">${escapeHtml(data.message || "Start shopping to earn points!")}</p>
        </div>
      </div>
    `;
  }

  function renderWidget(root, data) {
    if (!data.available) {
      renderUnavailable(root, data);
      return;
    }

    if (!data.loggedIn) {
      renderGuest(root, data);
      return;
    }

    if (!data.enrolled) {
      renderLoggedInNotEnrolled(root, data);
      return;
    }

    renderEnrolled(root, data);
  }

  async function initWidget(root) {
    try {
      const response = await fetch(API_PATH, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = await response.json();
      renderWidget(root, data);
    } catch (error) {
      console.error("[LoyaltyPulse] widget load failed:", error);
      root.innerHTML = `<div class="lpw-card"><div class="lpw-error">Unable to load loyalty rewards. Please try again later.</div></div>`;
    }
  }

  function boot() {
    document.querySelectorAll("[data-loyaltypulse-widget]").forEach(initWidget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
