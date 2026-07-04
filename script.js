window.AxiomRuntime =
  window.AxiomRuntime ||
  {
    formatTimestamp(value) {
      return new Date(value || Date.now()).toLocaleString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  };
