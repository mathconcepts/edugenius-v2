/**
 * PasskeyManager.tsx
 * 
 * UI for managing WebAuthn passkeys (Face ID, Touch ID, Windows Hello, hardware keys).
 * 
 * Features:
 * - List registered passkeys with device type icons
 * - Add new passkey (platform or roaming authenticator)
 * - Rename passkeys
 * - Delete passkeys
 * - Show backup status (synced to cloud vs device-only)
 * 
 * Used in: Settings → Security → Passkeys
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PasskeyCredential {
  id: string;
  credentialId: string;
  name: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports: string[];
  aaguid: string;
  createdAt: string;
  lastUsedAt: string;
}

type PasskeyManagerView = 'list' | 'adding' | 'renaming' | 'deleting';

// ============================================================================
// Browser WebAuthn API helpers
// ============================================================================

function base64URLToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function uint8ArrayToBase64URL(array: Uint8Array): string {
  const binary = Array.from(array, byte => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function isWebAuthnSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ============================================================================
// API calls (replace with your actual API base URL)
// ============================================================================

const API_BASE = '/api';

async function fetchPasskeys(userId: string): Promise<PasskeyCredential[]> {
  const res = await fetch(`${API_BASE}/auth/passkey/credentials`, {
    headers: { 'X-User-Id': userId },
  });
  if (!res.ok) throw new Error('Failed to fetch passkeys');
  return res.json();
}

async function registerPasskey(
  userId: string,
  userName: string,
  displayName: string,
  credentialName?: string,
  authenticatorAttachment?: 'platform' | 'cross-platform'
): Promise<PasskeyCredential> {
  // Step 1: Get registration options from server
  const optionsRes = await fetch(`${API_BASE}/auth/passkey/register/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName, displayName, authenticatorAttachment }),
  });
  if (!optionsRes.ok) throw new Error('Failed to get registration options');
  const options = await optionsRes.json();

  // Step 2: Convert challenge and user.id from Base64URL to ArrayBuffer
  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64URLToUint8Array(options.challenge),
    user: {
      ...options.user,
      id: base64URLToUint8Array(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((cred: { id: string; type: string; transports: string[] }) => ({
      ...cred,
      id: base64URLToUint8Array(cred.id),
    })),
  };

  // Step 3: Invoke authenticator
  const credential = await navigator.credentials.create({ publicKey: publicKeyOptions }) as PublicKeyCredential;
  if (!credential) throw new Error('Registration cancelled');

  const response = credential.response as AuthenticatorAttestationResponse;

  // Step 4: Send to server for verification
  const verifyRes = await fetch(`${API_BASE}/auth/passkey/register/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialName,
      response: {
        id: credential.id,
        rawId: uint8ArrayToBase64URL(new Uint8Array(credential.rawId)),
        type: credential.type,
        response: {
          clientDataJSON: uint8ArrayToBase64URL(new Uint8Array(response.clientDataJSON)),
          attestationObject: uint8ArrayToBase64URL(new Uint8Array(response.attestationObject)),
          transports: response.getTransports ? response.getTransports() : [],
        },
      },
    }),
  });
  if (!verifyRes.ok) throw new Error('Registration verification failed');
  const result = await verifyRes.json();
  if (!result.verified) throw new Error(result.error || 'Registration failed');
  return result.credential;
}

async function renamePasskey(userId: string, credentialId: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/passkey/credentials/${credentialId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename passkey');
}

async function deletePasskey(userId: string, credentialId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/passkey/credentials/${credentialId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
  });
  if (!res.ok) throw new Error('Failed to delete passkey');
}

// ============================================================================
// Sub-components
// ============================================================================

function DeviceIcon({ transports, deviceType }: { transports: string[]; deviceType: string }) {
  const isInternal = transports.includes('internal');
  const isHybrid = transports.includes('hybrid');
  const isSynced = deviceType === 'multiDevice';

  if (isSynced) {
    return (
      <span title="Synced passkey (backed up to cloud)">
        🔐
      </span>
    );
  }
  if (isInternal) {
    return <span title="Platform authenticator (built-in biometrics)">📱</span>;
  }
  if (isHybrid) {
    return <span title="Cross-device passkey">📲</span>;
  }
  return <span title="Security key">🔑</span>;
}

function BackupBadge({ backedUp, deviceType }: { backedUp: boolean; deviceType: string }) {
  if (deviceType === 'multiDevice') {
    return (
      <span style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '12px',
        background: '#d1fae5',
        color: '#065f46',
        fontWeight: 500,
      }}>
        ☁️ Synced
      </span>
    );
  }
  if (!backedUp) {
    return (
      <span style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '12px',
        background: '#fef3c7',
        color: '#92400e',
        fontWeight: 500,
      }}>
        📵 Device only
      </span>
    );
  }
  return null;
}

function PasskeyCard({
  passkey,
  onRename,
  onDelete,
}: {
  passkey: PasskeyCredential;
  onRename: (passkey: PasskeyCredential) => void;
  onDelete: (passkey: PasskeyCredential) => void;
}) {
  const lastUsed = new Date(passkey.lastUsedAt);
  const created = new Date(passkey.createdAt);
  const now = new Date();
  
  const formatRelative = (date: Date) => {
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      marginBottom: '12px',
      transition: 'box-shadow 0.15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Icon */}
      <div style={{ fontSize: '32px', lineHeight: 1 }}>
        <DeviceIcon transports={passkey.transports} deviceType={passkey.deviceType} />
      </div>
      
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: '15px' }}>
            {passkey.name}
          </span>
          <BackupBadge backedUp={passkey.backedUp} deviceType={passkey.deviceType} />
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          Last used: {formatRelative(lastUsed)} · Added: {formatRelative(created)}
        </div>
      </div>
      
      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => onRename(passkey)}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#374151',
            cursor: 'pointer',
          }}
          title="Rename this passkey"
        >
          ✏️ Rename
        </button>
        <button
          onClick={() => onDelete(passkey)}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#dc2626',
            cursor: 'pointer',
          }}
          title="Remove this passkey"
        >
          🗑️ Remove
        </button>
      </div>
    </div>
  );
}

function AddPasskeyModal({
  onAdd,
  onClose,
  hasPlatformAuth,
}: {
  onAdd: (type: 'platform' | 'cross-platform' | 'any', name: string) => Promise<void>;
  onClose: () => void;
  hasPlatformAuth: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'platform' | 'cross-platform' | 'any'>(
    hasPlatformAuth ? 'platform' : 'cross-platform'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) {
      setError('Please give this passkey a name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onAdd(type, name.trim());
    } catch (e) {
      setError((e as Error).message || 'Failed to add passkey');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '32px',
        width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>Add a Passkey</h2>
        <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '14px' }}>
          Passkeys use your device's biometrics or PIN for fast, secure sign-in — no password needed.
        </p>

        {/* Type selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 600, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
            Authenticator type
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hasPlatformAuth && (
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
                border: `2px solid ${type === 'platform' ? '#6366f1' : '#e5e7eb'}`,
                borderRadius: '10px', cursor: 'pointer',
                background: type === 'platform' ? '#eef2ff' : '#fff',
              }}>
                <input
                  type="radio" value="platform"
                  checked={type === 'platform'}
                  onChange={() => setType('platform')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>📱 This device</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Face ID, Touch ID, Windows Hello, or device PIN
                  </div>
                </div>
              </label>
            )}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
              border: `2px solid ${type === 'cross-platform' ? '#6366f1' : '#e5e7eb'}`,
              borderRadius: '10px', cursor: 'pointer',
              background: type === 'cross-platform' ? '#eef2ff' : '#fff',
            }}>
              <input
                type="radio" value="cross-platform"
                checked={type === 'cross-platform'}
                onChange={() => setType('cross-platform')}
                style={{ marginTop: '2px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>🔑 Security key or another device</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  USB/NFC/BLE security key, or scan QR from another device
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontWeight: 600, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
            Name this passkey
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'platform' ? 'My iPhone 15' : 'YubiKey 5'}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #d1d5db', borderRadius: '8px',
              outline: 'none', boxSizing: 'border-box',
            }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '6px' }}>{error}</div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px', background: '#f3f4f6', border: 'none',
              borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: '#374151',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#a5b4fc' : '#6366f1',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: 600,
            }}
          >
            {loading ? '⏳ Setting up...' : '✅ Add Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({
  passkey,
  onSave,
  onClose,
}: {
  passkey: PasskeyCredential;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(passkey.name);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || name.trim() === passkey.name) { onClose(); return; }
    setLoading(true);
    await onSave(name.trim());
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '380px',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>Rename Passkey</h2>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', fontSize: '14px',
            border: '1px solid #d1d5db', borderRadius: '8px',
            outline: 'none', boxSizing: 'border-box', marginBottom: '20px',
          }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  passkey,
  onConfirm,
  onClose,
}: {
  passkey: PasskeyCredential;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await onConfirm();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '400px',
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>Remove Passkey?</h2>
        <p style={{ margin: '0 0 8px', color: '#374151', fontSize: '14px' }}>
          You're about to remove <strong>"{passkey.name}"</strong>.
        </p>
        <p style={{ margin: '0 0 24px', color: '#dc2626', fontSize: '13px', background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
          ⚠️ If this is your only passkey, you'll need to use your password to sign in.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading} style={{ padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? 'Removing...' : 'Remove Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface PasskeyManagerProps {
  userId: string;
  userEmail: string;
  userName: string;
}

const PasskeyManager: React.FC<PasskeyManagerProps> = ({ userId, userEmail, userName }) => {
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [view, setView] = useState<PasskeyManagerView>('list');
  const [selectedPasskey, setSelectedPasskey] = useState<PasskeyCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  const loadPasskeys = useCallback(async () => {
    try {
      const data = await fetchPasskeys(userId);
      setPasskeys(data);
    } catch (e) {
      setError('Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const supported = isWebAuthnSupported();
    setWebAuthnSupported(supported);
    if (supported) {
      isPlatformAuthenticatorAvailable().then(setHasPlatformAuth);
    }
    loadPasskeys();
  }, [loadPasskeys]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleAddPasskey = async (type: 'platform' | 'cross-platform' | 'any', name: string) => {
    const attachment = type === 'any' ? undefined : type;
    await registerPasskey(userId, userEmail, userName, name, attachment);
    await loadPasskeys();
    setView('list');
    showSuccess(`✅ "${name}" added successfully`);
  };

  const handleRenamePasskey = async (name: string) => {
    if (!selectedPasskey) return;
    await renamePasskey(userId, selectedPasskey.credentialId, name);
    await loadPasskeys();
    setView('list');
    setSelectedPasskey(null);
    showSuccess(`✅ Renamed to "${name}"`);
  };

  const handleDeletePasskey = async () => {
    if (!selectedPasskey) return;
    const deletedName = selectedPasskey.name;
    await deletePasskey(userId, selectedPasskey.credentialId);
    await loadPasskeys();
    setView('list');
    setSelectedPasskey(null);
    showSuccess(`🗑️ "${deletedName}" removed`);
  };

  // ---- Render ----

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Loading passkeys...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>
          🔐 Passkeys
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Sign in with biometrics or your device PIN — faster and more secure than passwords.
        </p>
      </div>

      {/* Not supported warning */}
      {!webAuthnSupported && (
        <div style={{
          padding: '16px', background: '#fef3c7', borderRadius: '10px',
          border: '1px solid #fbbf24', marginBottom: '20px',
        }}>
          <strong>⚠️ Passkeys not supported</strong>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#92400e' }}>
            Your browser doesn't support passkeys. Try Chrome 108+, Safari 16+, or Firefox 119+.
          </p>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div style={{
          padding: '12px 16px', background: '#d1fae5', borderRadius: '8px',
          fontSize: '14px', color: '#065f46', marginBottom: '16px',
          animation: 'fadeIn 0.3s ease',
        }}>
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          padding: '12px 16px', background: '#fee2e2', borderRadius: '8px',
          fontSize: '14px', color: '#991b1b', marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Passkey list */}
      {passkeys.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center',
          background: '#f9fafb', borderRadius: '12px',
          border: '2px dashed #e5e7eb', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔑</div>
          <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No passkeys yet</h3>
          <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
            Add a passkey to sign in faster using your fingerprint, face, or PIN.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          {passkeys.map(passkey => (
            <PasskeyCard
              key={passkey.id}
              passkey={passkey}
              onRename={pk => { setSelectedPasskey(pk); setView('renaming'); }}
              onDelete={pk => { setSelectedPasskey(pk); setView('deleting'); }}
            />
          ))}
        </div>
      )}

      {/* Add button */}
      {webAuthnSupported && (
        <button
          onClick={() => setView('adding')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 20px', background: '#6366f1', border: 'none',
            borderRadius: '10px', color: '#fff', fontSize: '15px',
            fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(99,102,241,0.35)',
          }}
        >
          <span style={{ fontSize: '18px' }}>+</span> Add a Passkey
        </button>
      )}

      {/* Info section */}
      <div style={{
        marginTop: '32px', padding: '20px', background: '#f8fafc',
        borderRadius: '12px', border: '1px solid #e2e8f0',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: '#374151' }}>
          About Passkeys
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { icon: '🔒', text: 'Passkeys are cryptographically bound to this site — phishing-resistant by design.' },
            { icon: '☁️', text: 'Synced passkeys (📱 icon) are backed up to iCloud Keychain, Google Password Manager, or similar.' },
            { icon: '📵', text: 'Device-only passkeys stay on your hardware. More secure, but can\'t be recovered if you lose the device.' },
            { icon: '🔑', text: 'You can add multiple passkeys — one per device for best recovery options.' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#475569' }}>
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {view === 'adding' && (
        <AddPasskeyModal
          onAdd={handleAddPasskey}
          onClose={() => setView('list')}
          hasPlatformAuth={hasPlatformAuth}
        />
      )}
      {view === 'renaming' && selectedPasskey && (
        <RenameModal
          passkey={selectedPasskey}
          onSave={handleRenamePasskey}
          onClose={() => { setView('list'); setSelectedPasskey(null); }}
        />
      )}
      {view === 'deleting' && selectedPasskey && (
        <DeleteConfirmModal
          passkey={selectedPasskey}
          onConfirm={handleDeletePasskey}
          onClose={() => { setView('list'); setSelectedPasskey(null); }}
        />
      )}
    </div>
  );
};

export default PasskeyManager;
