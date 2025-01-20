import {v4} from "uuid";
import {OidcConfig} from "../oidc-config";
import {TokenService} from "../service/token-service";

/**
 * Makes a fetch request with an access token included in the Authorization header as Bearer.
 * The token is obtained using the provided OIDC configuration via a new TokenService.
 *
 * @param {RequestInfo | URL} requestInfo - The URL or Request object for the request.
 * @param {RequestInit} [requestInit] - Optional initialization options for the request.
 * @returns {Promise<Response>} - A Promise that resolves to the Response object from the fetch request.
 * @this {OidcConfig}
 */
export async function createFetchWithAccessToken(this: OidcConfig, requestInfo: RequestInfo | URL, requestInit?: RequestInit): Promise<Response> {
    requestInit ||= {} as RequestInit;
    requestInit.method = requestInit.method || "GET";
    requestInit.headers = new Headers(requestInit.headers || {});

    const tokenService = new TokenService(this);
    const accessTokenInfo: { access_token: string } = await tokenService.requestAccessToken();
    requestInit.headers.append('Authorization', `Bearer ${accessTokenInfo.access_token}`);

    return fetch(requestInfo, requestInit);
}

/**
 * Makes a fetch request with an ID token included in the Authorization header.
 * The token is obtained using the provided OIDC configuration with a newly created TokenService.
 *
 * @param {RequestInfo | URL} requestInfo - The URL or Request object for the request.
 * @param {RequestInit} [requestInit] - Optional initialization options for the request.
 * @returns {Promise<Response>} - A Promise that resolves to the Response object from the fetch request.
 * @this {OidcConfig}
 */
export async function createFetchWithIdToken(this: OidcConfig, requestInfo: RequestInfo | URL, requestInit?: RequestInit): Promise<Response> {
    requestInit ||= {} as RequestInit;
    requestInit.method = requestInit.method || "GET";
    requestInit.headers = new Headers(requestInit.headers || {});

    const tokenService = new TokenService(this);
    const accessTokenInfo: { id_token: string } = await tokenService.requestAccessToken();
    requestInit.headers.append('Authorization', `Bearer ${accessTokenInfo.id_token}`);

    return fetch(requestInfo, requestInit);
}

/**
 * Makes a fetch request with correlation and request IDs included in the headers.
 * If a custom fetch function is provided (fetchFn), it will be used; otherwise, the global fetch will be used.
 *
 * @param {RequestInfo | URL} requestInfo - The URL or Request object for the request.
 * @param {RequestInit} [requestInit] - Optional initialization options for the request.
 * @returns {Promise<Response>} - A Promise that resolves to the Response object from the fetch request.
 * @this {Object} context - The context object containing an optional correlation ID and a custom fetch function.
 * @this {string} [context.correlationId] - Optional correlation ID for the request.
 * @this {Function} [context.fetchFn] - Optional custom fetch function.
 */
export async function createFetchWithCorrelationAndRequestId(this: { correlationId?: string, fetchFn?: Function }, requestInfo: RequestInfo | URL, requestInit?: RequestInit): Promise<Response> {
    requestInit ||= {} as RequestInit;
    requestInit.headers = new Headers(requestInit.headers || {});

    requestInit.headers.append('X-Correlation-ID', this.correlationId || v4());
    requestInit.headers.set('X-Request-ID', v4());

    if(this.fetchFn) {
        return this.fetchFn(requestInfo, requestInit);
    } else {
        return fetch(requestInfo, requestInit);
    }
}