window.AxiomCommunications =
  window.AxiomCommunications ||
  {
    ready: true,
    queuePreview(payload = {}) {
      return {
        category: payload.category || "general",
        toName: payload.toName || "Contact",
        body: payload.body || "",
      };
    },
  };
