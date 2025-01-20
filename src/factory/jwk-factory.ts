import { JWK } from "jose";
import * as jose from "jose";

/**
 * Generates a new Elliptic Curve (ES256) JSON Web Key (JWK).
 * This function creates a key pair, exports the private key as a JWK, and assigns the 'ES256' algorithm.
 *
 * @returns {Promise<JWK>} - A Promise that resolves to the private JWK (JSON Web Key) object with the 'ES256' algorithm.
 */
export async function createJwk(): Promise<JWK> {
    const { privateKey } = await jose.generateKeyPair('ES256')
    const privateJwk = await jose.exportJWK(privateKey)
    privateJwk.alg = 'ES256';
    return privateJwk;
}