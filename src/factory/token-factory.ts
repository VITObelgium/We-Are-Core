import { v4 } from "uuid";
import { JWK, SignJWT, importJWK } from "jose";
import { extractJwkJson } from "../operator/jwk-operator";

/**
 * Creates a signed JWT dpop header
 * This function extracts the jwk information and uses it to create a dpop header.
 *
 * @returns {String} - A signed dpod header.
 */
export async function createDpop(uri: string, method: string, jwk: JWK) {
    const { privateJwk, privateKey, publicJwk } = (await extractJwkJson(jwk));

    return await new SignJWT({ htm: method, htu: uri }).setProtectedHeader({alg: privateJwk.alg!, typ: "dpop+jwt", jwk: publicJwk}).setJti(v4()).setIssuedAt().sign(privateKey);
}