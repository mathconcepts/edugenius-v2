// @ts-nocheck
/**
 * WebAuthn / Passkey Authentication
 * 
 * Implements FIDO2/WebAuthn for passwordless authentication.
 * Supports platform authenticators (Face ID, Touch ID, Windows Hello)
 * and roaming authenticators (hardware security keys).
 * 
 * Spec: https://www.w3.org/TR/webauthn-2/
 * 
 * Note: In production, use @simplewebauthn/server or similar library.
 * This implementation demonstrates the full flow with manual CBOR/COSE parsing.
 */

import * as crypto from 'crypto';
import { EventBus } from '../events/event-bus';

// ============================================================================
// Types
// ============================================================================

export type AuthenticatorTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid';
export type AttestationConveyancePreference = 'none' | 'indirect' | 'direct' | 'enterprise';
export type UserVerificationRequirement = 'required' | 'preferred' | 'discouraged';
export type PublicKeyCredentialType = 'public-key';
export type COSEAlgorithmIdentifier = -7 | -8 | -35 | -36 | -257; // ES256, EdDSA, ES384, ES512, RS256

export interface PasskeyCredential {
  id: string;
  userId: string;
  credentialId: string;          // Base64URL encoded
  credentialPublicKey: string;   // Base64URL encoded COSE key
  counter: number;               // Signature counter for replay protection
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports: AuthenticatorTransport[];
  aaguid: string;                // Authenticator model identifier
  name: string;                  // User-assigned name (e.g., "My iPhone")
  createdAt: Date;
  lastUsedAt: Date;
  rpId: string;                  // Relying Party ID (domain)
}

export interface RegistrationOptions {
  challenge: string;             // Base64URL
  rp: {
    id: string;
    name: string;
  };
  user: {
    id: string;                  // Base64URL encoded user ID
    name: string;                // Username/email
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: PublicKeyCredentialType;
    alg: COSEAlgorithmIdentifier;
  }>;
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey: 'required' | 'preferred' | 'discouraged';
    requireResidentKey: boolean;
    userVerification: UserVerificationRequirement;
  };
  attestation: AttestationConveyancePreference;
  timeout: number;
  excludeCredentials: Array<{
    type: PublicKeyCredentialType;
    id: string;
    transports: AuthenticatorTransport[];
  }>;
}

export interface AuthenticationOptions {
  challenge: string;             // Base64URL
  rpId: string;
  allowCredentials: Array<{
    type: PublicKeyCredentialType;
    id: string;
    transports: AuthenticatorTransport[];
  }>;
  userVerification: UserVerificationRequirement;
  timeout: number;
}

export interface RegistrationResponse {
  id: string;
  rawId: string;
  type: PublicKeyCredentialType;
  response: {
    clientDataJSON: string;      // Base64URL
    attestationObject: string;   // Base64URL
    transports?: AuthenticatorTransport[];
  };
}

export interface AuthenticationResponse {
  id: string;
  rawId: string;
  type: PublicKeyCredentialType;
  response: {
    clientDataJSON: string;      // Base64URL
    authenticatorData: string;   // Base64URL
    signature: string;           // Base64URL
    userHandle?: string;         // Base64URL (resident key)
  };
}

export interface VerificationResult {
  verified: boolean;
  userId?: string;
  credentialId?: string;
  newCounter?: number;
  error?: string;
}

export interface WebAuthnConfig {
  rpId: string;                  // Domain (e.g., "edugenius.app")
  rpName: string;                // Display name
  origin: string;                // Full origin (e.g., "https://edugenius.app")
  challengeTTLMs: number;        // Challenge expiry (default: 5 minutes)
  requireUserVerification: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a cryptographically random challenge
 */
export function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Base64URL encode
 */
export function toBase64URL(buffer: Buffer): string {
  return buffer.toString('base64url');
}

/**
 * Base64URL decode
 */
export function fromBase64URL(str: string): Buffer {
  // Add padding if needed
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64');
}

/**
 * Parse CBOR-encoded authenticator data
 * Simplified CBOR parser for WebAuthn authenticator data format
 */
export function parseAuthenticatorData(authData: Buffer): {
  rpIdHash: Buffer;
  flags: {
    userPresent: boolean;
    userVerified: boolean;
    backupEligible: boolean;
    backupState: boolean;
    attestedCredentialData: boolean;
    extensionData: boolean;
  };
  signCount: number;
  aaguid?: Buffer;
  credentialId?: Buffer;
  credentialPublicKey?: Buffer;
} {
  let offset = 0;

  // RP ID Hash (32 bytes)
  const rpIdHash = authData.slice(offset, offset + 32);
  offset += 32;

  // Flags (1 byte)
  const flagsByte = authData.readUInt8(offset);
  offset += 1;
  const flags = {
    userPresent: !!(flagsByte & 0x01),
    userVerified: !!(flagsByte & 0x04),
    backupEligible: !!(flagsByte & 0x08),
    backupState: !!(flagsByte & 0x10),
    attestedCredentialData: !!(flagsByte & 0x40),
    extensionData: !!(flagsByte & 0x80),
  };

  // Signature counter (4 bytes, big-endian)
  const signCount = authData.readUInt32BE(offset);
  offset += 4;

  let aaguid: Buffer | undefined;
  let credentialId: Buffer | undefined;
  let credentialPublicKey: Buffer | undefined;

  if (flags.attestedCredentialData) {
    // AAGUID (16 bytes)
    aaguid = authData.slice(offset, offset + 16);
    offset += 16;

    // Credential ID length (2 bytes, big-endian)
    const credentialIdLength = authData.readUInt16BE(offset);
    offset += 2;

    // Credential ID
    credentialId = authData.slice(offset, offset + credentialIdLength);
    offset += credentialIdLength;

    // Credential public key (remaining bytes, CBOR-encoded COSE key)
    credentialPublicKey = authData.slice(offset);
  }

  return { rpIdHash, flags, signCount, aaguid, credentialId, credentialPublicKey };
}

/**
 * Parse client data JSON
 */
export function parseClientData(clientDataJSON: string): {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
} {
  const decoded = fromBase64URL(clientDataJSON).toString('utf8');
  return JSON.parse(decoded);
}

/**
 * Format AAGUID as UUID string
 */
export function formatAAGUID(aaguid: Buffer): string {
  const hex = aaguid.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * Get device type from flags and AAGUID
 */
export function getDeviceType(flags: { backupEligible: boolean; backupState: boolean }): 'singleDevice' | 'multiDevice' {
  // Multi-device credentials are synced (e.g., iCloud Keychain, Google Password Manager)
  return flags.backupEligible ? 'multiDevice' : 'singleDevice';
}

/**
 * Known authenticator names by AAGUID
 */
const KNOWN_AUTHENTICATORS: Record<string, string> = {
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Android',
  'b93fd961-f2e6-462f-b122-82002247de78': 'Chrome on Android (Backup)',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keepass',
  'fbefdf68-fe86-0106-213e-4d5fa24cbe2e': 'Dashlane',
  'bada5566-a7aa-401f-bd96-45619a55a4b2': 'Apple Touch ID',
  'facefacefacefaceface0004': 'Apple Face ID',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain',
};

export function getAuthenticatorName(aaguid: string): string {
  return KNOWN_AUTHENTICATORS[aaguid.toLowerCase()] || 'Security Key';
}

// ============================================================================
// WebAuthn Service
// ============================================================================

// In-memory stores (replace with database in production)
const credentials = new Map<string, PasskeyCredential>();          // credentialId -> credential
const userCredentials = new Map<string, Set<string>>();            // userId -> Set<credentialId>
const challengeStore = new Map<string, { userId?: string; expiresAt: Date; type: 'registration' | 'authentication' }>();

let eventBus: EventBus | null = null;
let webauthnConfig: WebAuthnConfig = {
  rpId: 'localhost',
  rpName: 'EduGenius',
  origin: 'http://localhost:3000',
  challengeTTLMs: 5 * 60 * 1000, // 5 minutes
  requireUserVerification: true,
};

export function configureWebAuthn(config: Partial<WebAuthnConfig>): void {
  webauthnConfig = { ...webauthnConfig, ...config };
}

export function setWebAuthnEventBus(bus: EventBus): void {
  eventBus = bus;
}

// ============================================================================
// Registration Flow
// ============================================================================

/**
 * Generate registration options for a user
 * Called when user wants to add a passkey
 */
export async function generateRegistrationOptions(
  userId: string,
  userName: string,
  displayName: string,
  authenticatorAttachment?: 'platform' | 'cross-platform'
): Promise<RegistrationOptions> {
  // Generate challenge
  const challenge = generateChallenge();
  
  // Store challenge with expiry
  challengeStore.set(challenge, {
    userId,
    type: 'registration',
    expiresAt: new Date(Date.now() + webauthnConfig.challengeTTLMs),
  });

  // Get existing credentials to exclude (prevent re-registering same device)
  const existingCredentialIds = userCredentials.get(userId) || new Set();
  const excludeCredentials: RegistrationOptions['excludeCredentials'] = [];
  
  for (const credId of existingCredentialIds) {
    const cred = credentials.get(credId);
    if (cred) {
      excludeCredentials.push({
        type: 'public-key',
        id: cred.credentialId,
        transports: cred.transports,
      });
    }
  }

  return {
    challenge,
    rp: {
      id: webauthnConfig.rpId,
      name: webauthnConfig.rpName,
    },
    user: {
      id: toBase64URL(Buffer.from(userId)),
      name: userName,
      displayName,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256 (preferred)
      { type: 'public-key', alg: -257 },  // RS256 (Windows Hello compatibility)
      { type: 'public-key', alg: -8 },    // EdDSA (newer devices)
    ],
    authenticatorSelection: {
      authenticatorAttachment,
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: webauthnConfig.requireUserVerification ? 'required' : 'preferred',
    },
    attestation: 'none', // 'none' for privacy, 'direct' for enterprise
    timeout: 60000,
    excludeCredentials,
  };
}

/**
 * Verify registration response from browser
 * Called after user completes authenticator interaction
 */
export async function verifyRegistration(
  response: RegistrationResponse,
  credentialName?: string
): Promise<{ verified: boolean; credential?: PasskeyCredential; error?: string }> {
  try {
    // 1. Parse client data
    const clientData = parseClientData(response.response.clientDataJSON);
    
    // 2. Verify type
    if (clientData.type !== 'webauthn.create') {
      return { verified: false, error: 'Invalid client data type' };
    }
    
    // 3. Verify challenge
    const challengeData = challengeStore.get(clientData.challenge);
    if (!challengeData) {
      return { verified: false, error: 'Challenge not found or expired' };
    }
    if (challengeData.expiresAt < new Date()) {
      challengeStore.delete(clientData.challenge);
      return { verified: false, error: 'Challenge expired' };
    }
    if (challengeData.type !== 'registration') {
      return { verified: false, error: 'Wrong challenge type' };
    }
    
    // Remove used challenge
    challengeStore.delete(clientData.challenge);
    
    // 4. Verify origin
    if (clientData.origin !== webauthnConfig.origin) {
      return { verified: false, error: `Origin mismatch: expected ${webauthnConfig.origin}, got ${clientData.origin}` };
    }
    
    // 5. Parse attestation object (CBOR-encoded)
    // In production, use a proper CBOR library (@simplewebauthn/server handles this)
    const attestationBuffer = fromBase64URL(response.response.attestationObject);
    
    // For 'none' attestation format, we can skip attestation verification
    // Extract authData from the attestation object
    // Simple extraction: find the authData key in the CBOR map
    // Real implementation: use cbor.decode(attestationBuffer)
    const authData = extractAuthDataFromAttestation(attestationBuffer);
    if (!authData) {
      return { verified: false, error: 'Failed to parse attestation object' };
    }
    
    // 6. Parse authenticator data
    const parsedAuthData = parseAuthenticatorData(authData);
    
    // 7. Verify RP ID hash
    const expectedRpIdHash = crypto.createHash('sha256').update(webauthnConfig.rpId).digest();
    if (!parsedAuthData.rpIdHash.equals(expectedRpIdHash)) {
      return { verified: false, error: 'RP ID hash mismatch' };
    }
    
    // 8. Verify user presence
    if (!parsedAuthData.flags.userPresent) {
      return { verified: false, error: 'User presence required' };
    }
    
    // 9. Verify user verification (if required)
    if (webauthnConfig.requireUserVerification && !parsedAuthData.flags.userVerified) {
      return { verified: false, error: 'User verification required' };
    }
    
    // 10. Check credential data exists
    if (!parsedAuthData.credentialId || !parsedAuthData.credentialPublicKey) {
      return { verified: false, error: 'No credential data in authenticator data' };
    }
    
    const credentialId = toBase64URL(parsedAuthData.credentialId);
    
    // 11. Check credential ID is not already registered
    if (credentials.has(credentialId)) {
      return { verified: false, error: 'Credential already registered' };
    }
    
    // 12. Extract AAGUID
    const aaguid = parsedAuthData.aaguid 
      ? formatAAGUID(parsedAuthData.aaguid) 
      : '00000000-0000-0000-0000-000000000000';
    
    // 13. Determine device type and backup state
    const deviceType = getDeviceType(parsedAuthData.flags);
    
    // 14. Build credential record
    const userId = challengeData.userId!;
    const credential: PasskeyCredential = {
      id: crypto.randomBytes(16).toString('hex'),
      userId,
      credentialId,
      credentialPublicKey: toBase64URL(parsedAuthData.credentialPublicKey),
      counter: parsedAuthData.signCount,
      deviceType,
      backedUp: parsedAuthData.flags.backupState,
      transports: (response.response.transports || []) as AuthenticatorTransport[],
      aaguid,
      name: credentialName || getAuthenticatorName(aaguid),
      createdAt: new Date(),
      lastUsedAt: new Date(),
      rpId: webauthnConfig.rpId,
    };
    
    // 15. Store credential
    credentials.set(credentialId, credential);
    if (!userCredentials.has(userId)) {
      userCredentials.set(userId, new Set());
    }
    userCredentials.get(userId)!.add(credentialId);
    
    // 16. Emit event
    eventBus?.emit({
      type: 'passkey.registered',
      source: 'webauthn',
      data: {
        userId,
        credentialId,
        aaguid,
        deviceType,
        authenticatorName: credential.name,
      },
    });
    
    return { verified: true, credential };
    
  } catch (error) {
    console.error('WebAuthn registration error:', error);
    return { verified: false, error: `Verification failed: ${(error as Error).message}` };
  }
}

// ============================================================================
// Authentication Flow
// ============================================================================

/**
 * Generate authentication options
 * Called when user wants to sign in with a passkey
 */
export async function generateAuthenticationOptions(
  userId?: string  // Optional: if provided, only allow that user's credentials
): Promise<AuthenticationOptions> {
  const challenge = generateChallenge();
  
  challengeStore.set(challenge, {
    userId,
    type: 'authentication',
    expiresAt: new Date(Date.now() + webauthnConfig.challengeTTLMs),
  });

  const allowCredentials: AuthenticationOptions['allowCredentials'] = [];
  
  if (userId) {
    // User-specific authentication (email-first flow)
    const userCreds = userCredentials.get(userId) || new Set();
    for (const credId of userCreds) {
      const cred = credentials.get(credId);
      if (cred) {
        allowCredentials.push({
          type: 'public-key',
          id: cred.credentialId,
          transports: cred.transports,
        });
      }
    }
  }
  // If no userId, allowCredentials is empty → browser shows discoverable credential picker
  
  return {
    challenge,
    rpId: webauthnConfig.rpId,
    allowCredentials,
    userVerification: webauthnConfig.requireUserVerification ? 'required' : 'preferred',
    timeout: 60000,
  };
}

/**
 * Verify authentication response
 */
export async function verifyAuthentication(
  response: AuthenticationResponse
): Promise<VerificationResult> {
  try {
    // 1. Look up credential
    const credentialId = response.id;
    const credential = credentials.get(credentialId);
    
    if (!credential) {
      return { verified: false, error: 'Credential not found' };
    }
    
    // 2. Parse client data
    const clientData = parseClientData(response.response.clientDataJSON);
    
    // 3. Verify type
    if (clientData.type !== 'webauthn.get') {
      return { verified: false, error: 'Invalid client data type' };
    }
    
    // 4. Verify challenge
    const challengeData = challengeStore.get(clientData.challenge);
    if (!challengeData) {
      return { verified: false, error: 'Challenge not found or expired' };
    }
    if (challengeData.expiresAt < new Date()) {
      challengeStore.delete(clientData.challenge);
      return { verified: false, error: 'Challenge expired' };
    }
    if (challengeData.type !== 'authentication') {
      return { verified: false, error: 'Wrong challenge type' };
    }
    
    // 5. Verify user matches (if challenge was user-specific)
    if (challengeData.userId && challengeData.userId !== credential.userId) {
      return { verified: false, error: 'Credential belongs to different user' };
    }
    
    // Remove used challenge
    challengeStore.delete(clientData.challenge);
    
    // 6. Verify origin
    if (clientData.origin !== webauthnConfig.origin) {
      return { verified: false, error: 'Origin mismatch' };
    }
    
    // 7. Parse authenticator data
    const authDataBuffer = fromBase64URL(response.response.authenticatorData);
    const parsedAuthData = parseAuthenticatorData(authDataBuffer);
    
    // 8. Verify RP ID hash
    const expectedRpIdHash = crypto.createHash('sha256').update(webauthnConfig.rpId).digest();
    if (!parsedAuthData.rpIdHash.equals(expectedRpIdHash)) {
      return { verified: false, error: 'RP ID hash mismatch' };
    }
    
    // 9. Verify user presence
    if (!parsedAuthData.flags.userPresent) {
      return { verified: false, error: 'User presence required' };
    }
    
    // 10. Verify user verification
    if (webauthnConfig.requireUserVerification && !parsedAuthData.flags.userVerified) {
      return { verified: false, error: 'User verification required' };
    }
    
    // 11. Verify signature
    const signatureBuffer = fromBase64URL(response.response.signature);
    const clientDataHash = crypto
      .createHash('sha256')
      .update(fromBase64URL(response.response.clientDataJSON))
      .digest();
    
    // Data that was signed: authData || clientDataHash
    const signedData = Buffer.concat([authDataBuffer, clientDataHash]);
    
    const publicKeyBuffer = fromBase64URL(credential.credentialPublicKey);
    const isValid = verifyCOSESignature(publicKeyBuffer, signedData, signatureBuffer);
    
    if (!isValid) {
      return { verified: false, error: 'Signature verification failed' };
    }
    
    // 12. Verify counter (replay attack protection)
    if (parsedAuthData.signCount !== 0 && parsedAuthData.signCount <= credential.counter) {
      // Counter must increase (unless authenticator doesn't use counters, signCount === 0)
      return { verified: false, error: 'Signature counter check failed (possible cloned credential)' };
    }
    
    // 13. Update credential
    const newCounter = parsedAuthData.signCount;
    credential.counter = newCounter;
    credential.lastUsedAt = new Date();
    credential.backedUp = parsedAuthData.flags.backupState;
    credentials.set(credentialId, credential);
    
    // 14. Emit event
    eventBus?.emit({
      type: 'passkey.authenticated',
      source: 'webauthn',
      data: {
        userId: credential.userId,
        credentialId,
        newCounter,
      },
    });
    
    return {
      verified: true,
      userId: credential.userId,
      credentialId,
      newCounter,
    };
    
  } catch (error) {
    console.error('WebAuthn authentication error:', error);
    return { verified: false, error: `Verification failed: ${(error as Error).message}` };
  }
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Get all passkeys for a user
 */
export function getUserCredentials(userId: string): PasskeyCredential[] {
  const credIds = userCredentials.get(userId) || new Set();
  const result: PasskeyCredential[] = [];
  for (const credId of credIds) {
    const cred = credentials.get(credId);
    if (cred) result.push(cred);
  }
  return result.sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
}

/**
 * Rename a passkey
 */
export function renameCredential(userId: string, credentialId: string, name: string): boolean {
  const cred = credentials.get(credentialId);
  if (!cred || cred.userId !== userId) return false;
  cred.name = name;
  credentials.set(credentialId, cred);
  return true;
}

/**
 * Delete a passkey
 */
export function deleteCredential(userId: string, credentialId: string): boolean {
  const cred = credentials.get(credentialId);
  if (!cred || cred.userId !== userId) return false;
  
  credentials.delete(credentialId);
  userCredentials.get(userId)?.delete(credentialId);
  
  eventBus?.emit({
    type: 'passkey.deleted',
    source: 'webauthn',
    data: { userId, credentialId },
  });
  
  return true;
}

/**
 * Check if user has any passkeys
 */
export function userHasPasskeys(userId: string): boolean {
  const creds = userCredentials.get(userId);
  return !!(creds && creds.size > 0);
}

/**
 * Get passkey count for a user
 */
export function getUserPasskeyCount(userId: string): number {
  return userCredentials.get(userId)?.size || 0;
}

// ============================================================================
// COSE Key Parsing & Signature Verification
// ============================================================================

/**
 * Verify a COSE-encoded signature
 * Supports ES256 (-7) and RS256 (-257) algorithms
 * 
 * In production, use @noble/curves or @simplewebauthn/server
 */
function verifyCOSESignature(
  cosePublicKey: Buffer,
  data: Buffer,
  signature: Buffer
): boolean {
  try {
    // Parse CBOR-encoded COSE key to extract algorithm and public key bytes
    const { algorithm, keyData } = parseCOSEKey(cosePublicKey);
    
    if (algorithm === -7) {
      // ES256: ECDSA with P-256 and SHA-256
      return verifyES256(keyData, data, signature);
    } else if (algorithm === -257) {
      // RS256: RSASSA-PKCS1-v1_5 with SHA-256
      return verifyRS256(keyData, data, signature);
    } else if (algorithm === -8) {
      // EdDSA: Ed25519
      return verifyEdDSA(keyData, data, signature);
    } else {
      console.warn(`Unsupported COSE algorithm: ${algorithm}`);
      return false;
    }
  } catch (error) {
    console.error('COSE signature verification error:', error);
    return false;
  }
}

/**
 * Parse CBOR-encoded COSE key
 * Returns algorithm identifier and raw key bytes
 * 
 * COSE Key Structure (Map):
 * 1 (kty): 2 (EC2) or 3 (RSA) or 1 (OKP for EdDSA)
 * 3 (alg): -7 (ES256) or -257 (RS256) or -8 (EdDSA)
 * -1 (crv): 1 (P-256) for EC2
 * -2 (x): x coordinate
 * -3 (y): y coordinate
 */
function parseCOSEKey(coseKey: Buffer): { algorithm: number; keyData: Record<string, Buffer | number> } {
  // Simplified CBOR parser for COSE keys
  // In production: const coseMap = cbor.decode(coseKey)
  
  // We'll use a basic CBOR decoder for the specific structure we expect
  const decoded = simpleCBORDecode(coseKey);
  
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid COSE key structure');
  }
  
  const algorithm = decoded[3] as number; // key 3 = alg
  
  return { algorithm, keyData: decoded as Record<string, Buffer | number> };
}

/**
 * Verify ES256 signature (ECDSA P-256 + SHA-256)
 */
function verifyES256(
  keyData: Record<string, Buffer | number>,
  data: Buffer,
  signature: Buffer
): boolean {
  // Extract x and y coordinates (COSE keys -2, -3)
  const x = keyData[-2] as Buffer;
  const y = keyData[-3] as Buffer;
  
  if (!x || !y) {
    throw new Error('Missing EC key coordinates');
  }
  
  // Build uncompressed EC public key (0x04 || x || y)
  const uncompressedKey = Buffer.concat([Buffer.from([0x04]), x, y]);
  
  // Import as SubjectPublicKeyInfo (DER-encoded)
  const publicKey = createEC256PublicKey(uncompressedKey);
  
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  return verify.verify(publicKey, signature);
}

/**
 * Verify RS256 signature (RSASSA-PKCS1-v1_5 + SHA-256)
 */
function verifyRS256(
  keyData: Record<string, Buffer | number>,
  data: Buffer,
  signature: Buffer
): boolean {
  // RSA key components: n (modulus, -1), e (exponent, -2)
  const n = keyData[-1] as Buffer;
  const e = keyData[-2] as Buffer;
  
  if (!n || !e) {
    throw new Error('Missing RSA key components');
  }
  
  const publicKey = createRSAPublicKey(n, e);
  
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  return verify.verify(publicKey, signature);
}

/**
 * Verify EdDSA signature (Ed25519)
 */
function verifyEdDSA(
  keyData: Record<string, Buffer | number>,
  data: Buffer,
  signature: Buffer
): boolean {
  // EdDSA public key: x (-2)
  const x = keyData[-2] as Buffer;
  
  if (!x) {
    throw new Error('Missing EdDSA public key');
  }
  
  const publicKey = crypto.createPublicKey({
    key: x,
    format: 'der',
    type: 'pkcs8',
  });
  
  return crypto.verify(null, data, publicKey, signature);
}

/**
 * Create EC P-256 public key from uncompressed point
 */
function createEC256PublicKey(uncompressedPoint: Buffer): crypto.KeyObject {
  // SubjectPublicKeyInfo DER structure for P-256
  const spkiHeader = Buffer.from(
    '3059301306072a8648ce3d020106082a8648ce3d030107034200',
    'hex'
  );
  const spki = Buffer.concat([spkiHeader, uncompressedPoint]);
  
  return crypto.createPublicKey({
    key: spki,
    format: 'der',
    type: 'spki',
  });
}

/**
 * Create RSA public key from modulus and exponent
 */
function createRSAPublicKey(n: Buffer, e: Buffer): crypto.KeyObject {
  // RSAPublicKey DER structure
  const encodeLength = (len: number): Buffer => {
    if (len < 128) return Buffer.from([len]);
    const bytes = Math.ceil(len.toString(16).length / 2);
    return Buffer.from([0x80 | bytes, ...Array.from({ length: bytes }, (_, i) => (len >> ((bytes - 1 - i) * 8)) & 0xff)]);
  };
  
  const encodeInt = (buf: Buffer): Buffer => {
    // Add leading zero if high bit is set
    const data = buf[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), buf]) : buf;
    return Buffer.concat([Buffer.from([0x02]), encodeLength(data.length), data]);
  };
  
  const nEncoded = encodeInt(n);
  const eEncoded = encodeInt(e);
  const seqContent = Buffer.concat([nEncoded, eEncoded]);
  const seq = Buffer.concat([Buffer.from([0x30]), encodeLength(seqContent.length), seqContent]);
  
  // Wrap in BIT STRING
  const bitString = Buffer.concat([Buffer.from([0x03]), encodeLength(seq.length + 1), Buffer.from([0x00]), seq]);
  
  // AlgorithmIdentifier for RSA
  const algId = Buffer.from('300d06092a864886f70d0101010500', 'hex');
  
  // SubjectPublicKeyInfo
  const spkiContent = Buffer.concat([algId, bitString]);
  const spki = Buffer.concat([Buffer.from([0x30]), encodeLength(spkiContent.length), spkiContent]);
  
  return crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

// ============================================================================
// Simplified CBOR Decoder
// ============================================================================

/**
 * Basic CBOR decoder for WebAuthn data structures
 * Only handles the subset of CBOR used in WebAuthn:
 * - Maps (major type 5)
 * - Byte strings (major type 2)
 * - Text strings (major type 3)
 * - Integers (major types 0, 1)
 */
function simpleCBORDecode(buffer: Buffer): unknown {
  const [value] = decodeCBORValue(buffer, 0);
  return value;
}

function decodeCBORValue(buffer: Buffer, offset: number): [unknown, number] {
  if (offset >= buffer.length) {
    throw new Error('Unexpected end of CBOR data');
  }
  
  const initialByte = buffer[offset];
  const majorType = (initialByte >> 5) & 0x07;
  const additionalInfo = initialByte & 0x1f;
  offset++;
  
  let length: number;
  
  switch (additionalInfo) {
    case 24: length = buffer[offset++]; break;
    case 25: length = buffer.readUInt16BE(offset); offset += 2; break;
    case 26: length = buffer.readUInt32BE(offset); offset += 4; break;
    case 27: length = Number(buffer.readBigUInt64BE(offset)); offset += 8; break;
    default: length = additionalInfo;
  }
  
  switch (majorType) {
    case 0: // Unsigned integer
      return [length, offset];
      
    case 1: // Negative integer
      return [-1 - length, offset];
      
    case 2: { // Byte string
      const bytes = buffer.slice(offset, offset + length);
      return [bytes, offset + length];
    }
    
    case 3: { // Text string
      const text = buffer.slice(offset, offset + length).toString('utf8');
      return [text, offset + length];
    }
    
    case 4: { // Array
      const arr: unknown[] = [];
      for (let i = 0; i < length; i++) {
        const [item, newOffset] = decodeCBORValue(buffer, offset);
        arr.push(item);
        offset = newOffset;
      }
      return [arr, offset];
    }
    
    case 5: { // Map
      const map: Record<string | number, unknown> = {};
      for (let i = 0; i < length; i++) {
        const [key, keyOffset] = decodeCBORValue(buffer, offset);
        const [value, valueOffset] = decodeCBORValue(buffer, keyOffset);
        map[key as string | number] = value;
        offset = valueOffset;
      }
      return [map, offset];
    }
    
    case 7: // Float / simple values
      if (additionalInfo === 20) return [false, offset];
      if (additionalInfo === 21) return [true, offset];
      if (additionalInfo === 22) return [null, offset];
      return [undefined, offset];
      
    default:
      throw new Error(`Unsupported CBOR major type: ${majorType}`);
  }
}

/**
 * Extract authenticator data from CBOR-encoded attestation object
 * Attestation structure: { fmt: text, attStmt: map, authData: bytes }
 */
function extractAuthDataFromAttestation(attestationBuffer: Buffer): Buffer | null {
  try {
    const decoded = simpleCBORDecode(attestationBuffer) as Record<string, unknown>;
    if (!decoded || !decoded['authData']) {
      return null;
    }
    return decoded['authData'] as Buffer;
  } catch (error) {
    console.error('Failed to extract authData:', error);
    return null;
  }
}

// ============================================================================
// HTTP Route Handlers
// ============================================================================

/**
 * WebAuthn API routes
 * Integrate with your API server
 */
export const webAuthnRoutes = {
  
  /**
   * POST /auth/passkey/register/options
   * Get registration options for adding a new passkey
   */
  async getRegistrationOptions(req: {
    userId: string;
    userName: string;
    displayName: string;
    authenticatorAttachment?: 'platform' | 'cross-platform';
  }): Promise<RegistrationOptions> {
    return generateRegistrationOptions(
      req.userId,
      req.userName,
      req.displayName,
      req.authenticatorAttachment
    );
  },
  
  /**
   * POST /auth/passkey/register/verify
   * Verify registration and store credential
   */
  async verifyRegistration(req: {
    response: RegistrationResponse;
    credentialName?: string;
  }): Promise<{ verified: boolean; credential?: Partial<PasskeyCredential>; error?: string }> {
    const result = await verifyRegistration(req.response, req.credentialName);
    
    if (result.verified && result.credential) {
      // Return safe subset (exclude public key)
      return {
        verified: true,
        credential: {
          id: result.credential.id,
          credentialId: result.credential.credentialId,
          name: result.credential.name,
          deviceType: result.credential.deviceType,
          backedUp: result.credential.backedUp,
          transports: result.credential.transports,
          aaguid: result.credential.aaguid,
          createdAt: result.credential.createdAt,
        },
      };
    }
    
    return { verified: result.verified, error: result.error };
  },
  
  /**
   * POST /auth/passkey/authenticate/options
   * Get authentication options for signing in
   */
  async getAuthenticationOptions(req: {
    userId?: string; // Optional: for user-first flow
  }): Promise<AuthenticationOptions> {
    return generateAuthenticationOptions(req.userId);
  },
  
  /**
   * POST /auth/passkey/authenticate/verify
   * Verify authentication response
   */
  async verifyAuthentication(req: {
    response: AuthenticationResponse;
  }): Promise<VerificationResult> {
    return verifyAuthentication(req.response);
  },
  
  /**
   * GET /auth/passkey/credentials
   * List user's registered passkeys
   */
  async listCredentials(userId: string): Promise<Partial<PasskeyCredential>[]> {
    return getUserCredentials(userId).map(cred => ({
      id: cred.id,
      credentialId: cred.credentialId,
      name: cred.name,
      deviceType: cred.deviceType,
      backedUp: cred.backedUp,
      transports: cred.transports,
      aaguid: cred.aaguid,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
    }));
  },
  
  /**
   * PATCH /auth/passkey/credentials/:credentialId
   * Rename a passkey
   */
  async renameCredential(userId: string, credentialId: string, name: string): Promise<boolean> {
    return renameCredential(userId, credentialId, name);
  },
  
  /**
   * DELETE /auth/passkey/credentials/:credentialId
   * Delete a passkey
   */
  async deleteCredential(userId: string, credentialId: string): Promise<boolean> {
    return deleteCredential(userId, credentialId);
  },
};

// ============================================================================
// Exports
// ============================================================================

export {
  webauthnConfig,
};
