export function getApiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          if (typeof item.msg === "string" && item.msg.trim()) {
            return item.msg;
          }
          if (Array.isArray(item.loc)) {
            return `${item.loc.join(".")}: ${item.msg || "Invalid value"}`;
          }
        }
        return "Invalid request";
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.msg === "string" && detail.msg.trim()) {
      return detail.msg;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
}
