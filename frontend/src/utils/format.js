export function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

export function formatDate(iso, options) {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

export function formatDateTime(iso) {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

export function formatPercent(value, digits = 1) {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

export function getCustomerInitials(customer) {
  const first = customer?.firstName?.[0] ?? "";
  const last = customer?.lastName?.[0] ?? "";
  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }
  return customer?.email?.[0]?.toUpperCase() ?? "?";
}

export function formatCustomerName(customer, fallbackEmail) {
  const parts = [customer?.firstName, customer?.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return customer?.email ?? fallbackEmail ?? customer?.name ?? "Unknown";
}

export function trendFromSeries(series) {
  if (!series?.length) {
    return null;
  }

  const mid = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, mid).reduce((sum, point) => sum + Number(point.value ?? 0), 0);
  const secondHalf = series.slice(mid).reduce((sum, point) => sum + Number(point.value ?? 0), 0);

  if (firstHalf === 0 && secondHalf === 0) {
    return null;
  }

  if (firstHalf === 0) {
    return { direction: "up", value: 100, label: "vs prior period" };
  }

  const change = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  return {
    direction: change >= 0 ? "up" : "down",
    value: Math.abs(change),
    label: "vs prior period",
  };
}
