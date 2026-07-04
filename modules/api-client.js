window.AxiomApi =
  window.AxiomApi ||
  {
    async request(url, options) {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Request failed");
      }
      return data;
    },
  };
