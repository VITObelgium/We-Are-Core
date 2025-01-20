import { JWK, KeyLike, importJWK, calculateJwkThumbprint } from "jose";

/**
 * Extracts the public parts of an array of JWKs.
 * @param {Array<JWK>} jwks - The array of JSON Web Keys.
 * @returns {Array<JWK>} The array of public JSON Web Keys.
 */
export function extractPublicJwks(jwks: Array<JWK>) {
  const clone = JSON.parse(JSON.stringify(jwks)); // Create clone
  return clone.map((jwk: JWK) => {
    delete jwk.d;
    return jwk;
  });
}

/**
 * Extracts the JSON Web Keys (JWKs) and their corresponding public keys and thumbprints.
 * @param {Object} jwks - The object containing an array of JSON Web Keys.
 * @param {Array<JWK>} jwks.keys - The array of JSON Web Keys.
 * @returns {Promise<Array<{ privateJwk: JWK; privateKey: KeyLike | Uint8Array; publicJwk: any; jkt: string }>>}
 * A promise that resolves to an array of objects containing the private JWK, private key, public JWK, and JWK thumbprint.
 */
export async function extractJwksJson(jwks: {
  keys: Array<JWK>;
}): Promise<{ privateJwk: JWK; privateKey: KeyLike | Uint8Array; publicJwk: any; jkt: string }[]> {
  return await Promise.all(
    jwks.keys.map(async (privateJwk: JWK) => {
      const privateKey = await importJWK(privateJwk);
      const publicJwk = extractPublicJwks(new Array<JWK>(privateJwk))[0];
      const jkt = await calculateJwkThumbprint(publicJwk);
      return { privateJwk, privateKey, publicJwk, jkt };
    })
  );
}

/**
 * Extracts a JSON Web Key (JWK) and its corresponding public key and thumbprint.
 * @param {JWK} jwk - The JSON Web Key.
 * @returns {Promise<{ privateJwk: JWK; privateKey: KeyLike | Uint8Array; publicJwk: any; jkt: string }>}
 * A promise that resolves to an object containing the private JWK, private key, public JWK, and JWK thumbprint.
 */
export async function extractJwkJson(jwk: JWK): Promise<{ privateJwk: JWK; privateKey: KeyLike | Uint8Array; publicJwk: any; jkt: string; }> {
  const privateKey = await importJWK(jwk);
  const publicJwk = extractPublicJwks(new Array<JWK>(jwk))[0];
  const jkt = await calculateJwkThumbprint(jwk);
  const result = {
    privateJwk: jwk,
    privateKey: privateKey,
    publicJwk: publicJwk,
    jkt: jkt,

  }
  return result;
}
