window.AxiomDataWorkflows =
  window.AxiomDataWorkflows ||
  {
    ready: true,
    normaliseProgress(value) {
      return Math.max(0, Math.min(Number(value || 0), 100));
    },
  };
