(function () {
  const API_PATH = "/apps/loyaltypulse/loyalty";
  const REDEEM_PATH = "/apps/loyaltypulse/redeem";
  const REFERRAL_APPLY_PATH = "/apps/loyaltypulse/referrals/apply";

  const TIER_LABELS = {
    BRONZE: "Bronze",
    SILVER: "Silver",
    GOLD: "Gold",
    PLATINUM: "Platinum",
  };

  const PROXY_HEADERS = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
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

  function renderTierBadge(tierInfo, fallbackTier) {
    const name =
      tierInfo?.name || TIER_LABELS[fallbackTier] || fallbackTier || "Bronze";
    const color = tierInfo?.color;

    if (color) {
      return `<span class="lpw-tier-badge lpw-tier-badge--custom" style="background:${escapeHtml(color)}22;border-color:${escapeHtml(color)}66;color:${escapeHtml(color)}">${escapeHtml(name)}</span>`;
    }

    return `<span class="${tierClass(fallbackTier)}">${escapeHtml(name)}</span>`;
  }

  function renderTierProgress(tierInfo, fallbackTier) {
    if (!tierInfo) {
      return `
        <div class="lpw-tier-progress">
          <div class="lpw-tier-progress-row">
            <span class="lpw-tier-progress-label">Current tier</span>
            ${renderTierBadge(null, fallbackTier)}
          </div>
        </div>
      `;
    }

    const nextTierHtml = tierInfo.nextTier
      ? `
          <div class="lpw-tier-progress-row">
            <span class="lpw-tier-progress-label">Next tier</span>
            <span class="lpw-tier-next-name">${escapeHtml(tierInfo.nextTier.name)}</span>
          </div>
        `
      : "";

    const messageHtml = tierInfo.nextTierMessage
      ? `<p class="lpw-tier-progress-message">${escapeHtml(tierInfo.nextTierMessage)}</p>`
      : "";

    return `
      <div class="lpw-tier-progress">
        <div class="lpw-tier-progress-row">
          <span class="lpw-tier-progress-label">Current tier</span>
          ${renderTierBadge(tierInfo, tierInfo.key)}
        </div>
        ${nextTierHtml}
        ${messageHtml}
      </div>
    `;
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

  function renderReward(reward, pointsName, programActive) {
    const progress = Math.min(
      100,
      reward.pointsRequired > 0
        ? Math.round(
            ((reward.pointsRequired - reward.pointsNeeded) / reward.pointsRequired) * 100
          )
        : 100
    );

    const canRedeem = reward.canRedeem && programActive !== false;

    const status = canRedeem
      ? `<span class="lpw-reward-status lpw-reward-status--ready">Ready to redeem</span>`
      : reward.canRedeem
        ? `<span class="lpw-reward-status lpw-reward-status--locked">Redemption paused</span>`
        : `<span class="lpw-reward-status lpw-reward-status--locked">${formatCount(reward.pointsNeeded)} more ${escapeHtml(pointsName)} needed</span>`;

    const redeemButton = canRedeem
      ? `<button type="button" class="lpw-redeem-btn" data-reward-id="${escapeHtml(reward.id)}">Redeem</button>`
      : "";

    const description = reward.description
      ? `<p class="lpw-reward-desc">${escapeHtml(reward.description)}</p>`
      : "";

    return `
      <article class="lpw-reward" data-reward-id="${escapeHtml(reward.id)}">
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
        ${redeemButton}
      </article>
    `;
  }

  function renderReferralSection(data) {
    const referrals = data.referrals;
    if (!referrals?.referralUrl) {
      return "";
    }

    const programName = data.programName || data.pointsName || "Stars";
    const stats = referrals.stats ?? {};
    const received = referrals.receivedReferral;

    const receivedNote = received
      ? `<p class="lpw-referral-note">Referral code applied · status: ${escapeHtml(received.status)}</p>`
      : "";

    return `
      <div class="lpw-referral-section">
        <h3 class="lpw-section-title">Refer a friend</h3>
        ${receivedNote}
        <label class="lpw-referral-label" for="lpw-referral-link">Your referral link</label>
        <div class="lpw-referral-copy-row">
          <input
            id="lpw-referral-link"
            class="lpw-referral-input"
            type="text"
            readonly
            value="${escapeHtml(referrals.referralUrl)}"
          />
          <button type="button" class="lpw-referral-copy-btn" data-lpw-copy-referral>
            Copy
          </button>
        </div>
        <div class="lpw-referral-stats">
          <div class="lpw-referral-stat">
            <span class="lpw-referral-stat-value">${formatCount(stats.successfulReferrals)}</span>
            <span class="lpw-referral-stat-label">Successful referrals</span>
          </div>
          <div class="lpw-referral-stat">
            <span class="lpw-referral-stat-value">${formatCount(stats.pendingReferrals)}</span>
            <span class="lpw-referral-stat-label">Pending referrals</span>
          </div>
          <div class="lpw-referral-stat">
            <span class="lpw-referral-stat-value">${formatCount(stats.starsEarnedFromReferrals)}</span>
            <span class="lpw-referral-stat-label">${escapeHtml(programName)} earned from referrals</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderReviewStatus(data) {
    const review = data.reviewStatus;
    if (!review?.status) {
      return "";
    }

    const statusLabel =
      review.status === "COMPLETED"
        ? "Completed"
        : review.status === "SENT"
          ? "Sent"
          : "Pending";

    return `
      <div class="lpw-review-status">
        <h3 class="lpw-section-title">Review status</h3>
        <div class="lpw-review-status-row">
          <span class="lpw-review-status-badge lpw-review-status-badge--${escapeHtml(String(review.status).toLowerCase())}">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        ${
          review.message
            ? `<p class="lpw-review-status-message">${escapeHtml(review.message)}</p>`
            : ""
        }
      </div>
    `;
  }

  function renderSuccessBanner(message) {
    return `<div class="lpw-success" role="status">${escapeHtml(message)}</div>`;
  }

  function renderEnrolled(root, data, successMessage) {
    const programName = data.programName || data.pointsName || "points";
    const heading = root.dataset.heading || `Your ${programName}`;
    const tierInfo = data.tierInfo ?? null;
    const rewards = Array.isArray(data.rewards) ? data.rewards : [];

    const rewardsHtml =
      rewards.length > 0
        ? `<div class="lpw-rewards">${rewards.map((r) => renderReward(r, programName, data.programActive)).join("")}</div>`
        : `<p class="lpw-empty">No rewards available yet. Check back soon!</p>`;

    const inactiveNote = data.programActive
      ? ""
      : `<p class="lpw-message" style="margin-bottom:14px">The loyalty program is currently paused. Your balance is shown below.</p>`;

    const successHtml = successMessage ? renderSuccessBanner(successMessage) : "";

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
          ${successHtml}
          ${inactiveNote}
          <div class="lpw-stats">
            <div class="lpw-stat">
              <span class="lpw-stat-label">Your ${escapeHtml(programName)}</span>
              <span class="lpw-stat-value lpw-stat-value--accent" data-lpw-points-balance>${formatCount(data.pointsBalance)}</span>
            </div>
          </div>
          ${renderTierProgress(tierInfo, data.tier)}
          ${renderReferralSection(data)}
          ${renderReviewStatus(data)}
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

  function renderWidget(root, data, successMessage) {
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

    renderEnrolled(root, data, successMessage);
  }

  async function fetchLoyaltyData() {
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

    return response.json();
  }

  async function redeemReward(rewardId) {
    const response = await fetch(REDEEM_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: PROXY_HEADERS,
      body: JSON.stringify({ rewardId }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload.message ||
        payload.error ||
        `Redemption failed (${response.status})`;
      const error = new Error(message);
      error.code = payload.code;
      throw error;
    }

    return payload;
  }

  async function applyReferralCode(referralCode) {
    const response = await fetch(REFERRAL_APPLY_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: PROXY_HEADERS,
      body: JSON.stringify({ referralCode }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload.message ||
        payload.error ||
        `Referral apply failed (${response.status})`;
      const error = new Error(message);
      error.code = payload.code;
      throw error;
    }

    return payload;
  }

  function getReferralCodeFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("ref");
    } catch {
      return null;
    }
  }

  function attachReferralHandlers(root) {
    const copyButton = root.querySelector("[data-lpw-copy-referral]");
    const input = root.querySelector("#lpw-referral-link");

    if (copyButton && input) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(input.value);
          const original = copyButton.textContent;
          copyButton.textContent = "Copied!";
          setTimeout(() => {
            copyButton.textContent = original;
          }, 1600);
        } catch (error) {
          input.select();
          document.execCommand("copy");
        }
      });
    }
  }

  function attachRedeemHandlers(root) {
    root.querySelectorAll(".lpw-redeem-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const rewardId = button.getAttribute("data-reward-id");
        if (!rewardId || button.disabled) {
          return;
        }

        const rewardName =
          button.closest(".lpw-reward")?.querySelector(".lpw-reward-name")?.textContent?.trim() ||
          "Reward";

        button.disabled = true;
        button.classList.add("lpw-redeem-btn--loading");
        const originalLabel = button.textContent;
        button.textContent = "Redeeming…";

        try {
          const result = await redeemReward(rewardId);
          const data = await fetchLoyaltyData();
          const successMessage = `Redeemed ${rewardName}! Your coupon code: ${result.couponCode}`;
          renderWidget(root, data, successMessage);
          attachRedeemHandlers(root);
          attachReferralHandlers(root);
        } catch (error) {
          console.error("[LoyaltyPulse] redeem failed:", error);
          button.disabled = false;
          button.classList.remove("lpw-redeem-btn--loading");
          button.textContent = originalLabel;

          let userMessage = error.message || "Could not redeem this reward.";
          if (error.code === "insufficient_points") {
            userMessage = "You do not have enough points for this reward.";
          } else if (error.code === "reward_not_found") {
            userMessage = "This reward is no longer available.";
          } else if (error.code === "customer_not_found") {
            userMessage = "Your loyalty account was not found. Make a purchase to enroll.";
          }

          const existing = root.querySelector(".lpw-error-banner");
          if (existing) {
            existing.remove();
          }

          const banner = document.createElement("div");
          banner.className = "lpw-error-banner";
          banner.setAttribute("role", "alert");
          banner.textContent = userMessage;
          const body = root.querySelector(".lpw-body");
          if (body) {
            body.prepend(banner);
          }
        }
      });
    });
  }

  async function initWidget(root) {
    try {
      let data = await fetchLoyaltyData();

      const refCode = getReferralCodeFromUrl();
      if (refCode && data.loggedIn && !data.referrals?.receivedReferral) {
        try {
          await applyReferralCode(refCode);
          data = await fetchLoyaltyData();
        } catch (error) {
          if (error.code !== "referral_exists") {
            console.warn("[LoyaltyPulse] referral apply failed:", error.message);
          } else {
            data = await fetchLoyaltyData();
          }
        }
      }

      renderWidget(root, data);
      attachRedeemHandlers(root);
      attachReferralHandlers(root);
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
