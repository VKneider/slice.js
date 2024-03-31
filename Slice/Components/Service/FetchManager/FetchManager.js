export default class FetchManager {
    constructor(props) {
        const { baseUrl, timeout } = props;
        if (baseUrl !== undefined) {
            this.baseUrl = baseUrl;
        }
        this.methods = ["GET", "POST", "PUT", "DELETE"];
        this.lastRequest = null;
        this.cacheEnabled = false;
        this.defaultHeaders = {};
        timeout ? (this.timeout = timeout) : (this.timeout = 10000);
    }

    async request(
        method,
        data,
        endpoint,
        onRequestSuccess,
        onRequestError,
        refetchOnError = false,
        requestOptions = {}
    ) {
        if (!this.methods.includes(method)) throw new Error("Invalid method");
        if (data && typeof data !== "object")
            throw new Error("Invalid data, not JSON");
        const controller = new AbortController();

        let options;
        if (method !== "GET") {
            options = {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    ...this.defaultHeaders,
                    ...requestOptions.headers,
                },
                signal: controller.signal,
            };
        } else {
            options = {
                method: method,
                headers: {
                    ...this.defaultHeaders,
                    ...requestOptions.headers,
                },
                signal: controller.signal,
            };
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        let loading;
        if (!slice.controller.getComponent("Loading")) {
            loading = await slice.build("Loading", { sliceId: "Loading" });
        } else {
            loading = slice.controller.getComponent("Loading");
        }
        loading.start();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout || 10000);

        try {
            let response;

            // Check if cache is enabled and a cached response exists
            if (this.cacheEnabled && this.lastRequest && this.lastRequest.endpoint === endpoint) {
                return this.lastRequest.response;
            }

            if (this.baseUrl !== undefined) {
                response = await fetch(this.baseUrl + endpoint, options);
            } else {
                response = await fetch(endpoint, options);
            }

            if (response.ok) {
                if (typeof onRequestSuccess === "function") {
                    onRequestSuccess(data, response);
                }
            } else {
                if (typeof onRequestError === "function") {
                    onRequestError(data, response);
                }
                if (refetchOnError) {
                    // Retry the request in case of error
                    return await this.request(
                        method,
                        data,
                        endpoint,
                        onRequestSuccess,
                        onRequestError,
                        refetchOnError,
                        requestOptions
                    );
                }
            }

            let output = await response.json();
            loading.stop();

            // Cache the response if cache is enabled
            if (this.cacheEnabled) {
                this.lastRequest = { data, response, endpoint };
            }

            return output;
        } catch (error) {
            if (error.message === "Failed to fetch") {
                slice.logger.logError("Se perdió la conexión a internet");
            } else {
                console.error("Error al realizar la solicitud:", error);
            }
            loading.stop();
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Enable or disable caching of responses
    enableCache() {
        this.cacheEnabled = true;
    }

    disableCache() {
        this.cacheEnabled = false;
    }

    // Set default headers for all requests
    setDefaultHeaders(headers) {
        this.defaultHeaders = headers;
    }
}