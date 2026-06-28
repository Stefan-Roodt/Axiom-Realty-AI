(function attachApiClientModule(window) {
  async function request(path, { method = "GET", headers = {}, body = null, json = null, responseType = "json" } = {}) {
    const requestHeaders = { ...headers };
    let payload = body;
    if (json !== null) {
      requestHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(json);
    }

    const response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: payload,
      cache: method === "GET" ? "no-store" : "default"
    });

    if (responseType === "raw") return response;
    if (responseType === "blob") {
      if (!response.ok) throw await buildRequestError(response);
      return response.blob();
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function buildRequestError(response) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    return error;
  }

  window.AxiomApiClient = Object.freeze({
    request,
    getJson: (path, options = {}) => request(path, { ...options, method: "GET" }),
    postJson: (path, json = {}, options = {}) => request(path, { ...options, method: "POST", json }),
    getBlob: (path, options = {}) => request(path, { ...options, method: "GET", responseType: "blob" })
  });
})(window);
