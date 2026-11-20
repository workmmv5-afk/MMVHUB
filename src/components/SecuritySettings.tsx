import React, { useState } from 'react';
import {
  ClipboardX,
  Copy,
  EyeOff,
  Fingerprint,
  History,
  KeyRound,
  LifeBuoy,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import {
  PIN_MAX,
  PIN_MIN,
  isValidPin,
  readSecurityLog,
  type SecurityEvent,
} from '../lib/quickUnlock';
import { copyWithAutoClear } from '../lib/clipboard';
import { isNative } from '../lib/native';
import { t } from '../lib/i18n';

const EVENT_LABELS: Partial<Record<SecurityEvent, string>> = {
  'unlock-pin': 'Unlocked with PIN',
  'unlock-fingerprint': 'Unlocked with fingerprint',
  'unlock-passphrase': 'Unlocked with passphrase',
  'unlock-recovery': 'Unlocked with recovery code',
  'pin-wrong': 'Wrong PIN',
  'pin-cooldown': 'Wrong PIN · cooldown',
  locked: 'Locked',
  'pin-changed': 'PIN set / changed',
  'lock-removed': 'Lock removed',
  'fingerprint-on': 'Fingerprint on',
  'fingerprint-off': 'Fingerprint off',
  'passphrase-changed': 'Passphrase changed',
  'recovery-viewed': 'Recovery code viewed',
  'backup-exported': 'Backup exported',
};

const row =
  'flex items-center justify-between gap-3 py-3 border-t border-[#F0F4F9] dark:border-[#282A2C] first:border-t-0';
const btn =
  'min-h-[38px] px-4 rounded-full text-xs font-medium border border-[#DADCE0] dark:border-[#444746] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] disabled:opacity-50';

export const SecuritySettings: React.FC = () => {
  const {
    vaultMeta,
    biometricSupport,
    canLock,
    setVaultPin,
    removeVaultLock,
    enableBiometricUnlock,
    disableBiometricUnlock,
    lockVault,
    getRecoveryCode,
    preferences,
    updatePreferences,
  } = useVault();

  const hasPin = Boolean(vaultMeta?.quickUnlock?.pin);
  const hasBio = Boolean(vaultMeta?.quickUnlock?.bio);
  const [editingPin, setEditingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const savePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPin(pin)) return setError(`PIN must be ${PIN_MIN}–${PIN_MAX} digits.`);
    if (pin !== pin2) return setError('PINs don’t match.');
    void run(async () => {
      await setVaultPin(pin);
      setPin('');
      setPin2('');
      setEditingPin(false);
    });
  };

  const pinInput =
    'w-24 min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 text-center font-mono tracking-[0.4em] text-sm';

  return (
    <section
      id="settings-security"
      className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 scroll-mt-20"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
        <ShieldCheck className="w-4 h-4 hub-text-accent" />
        {t('settings.security')}
      </h2>

      {error && (
        <p role="alert" className="text-xs text-[#C5221F] dark:text-[#F28B82] py-1">
          {error}
        </p>
      )}

      {/* PIN */}
      <div className={row}>
        <div className="flex items-center gap-2.5 min-w-0">
          <KeyRound className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">PIN lock</p>
            <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
              {hasPin ? `${vaultMeta?.quickUnlock?.pin?.length}-digit PIN` : 'Off'}
            </p>
          </div>
        </div>
        {!editingPin && (
          <button type="button" className={btn} onClick={() => setEditingPin(true)}>
            {hasPin ? 'Change' : 'Set PIN'}
          </button>
        )}
      </div>
      {editingPin && (
        <form onSubmit={savePin} className="flex flex-wrap items-center gap-2 pb-3">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PIN_MAX}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="New"
            aria-label="New PIN"
            autoFocus
            className={pinInput}
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PIN_MAX}
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
            placeholder="Again"
            aria-label="Confirm PIN"
            className={pinInput}
          />
          <button type="submit" disabled={busy} className="min-h-[38px] px-4 rounded-full hub-bg-accent text-xs font-medium disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="min-h-[38px] px-3 text-xs text-[#5F6368]"
            onClick={() => {
              setEditingPin(false);
              setPin('');
              setPin2('');
              setError('');
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Fingerprint */}
      <div className={row}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Fingerprint className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Fingerprint unlock</p>
            <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
              {biometricSupport === 'none'
                ? 'Not available on this device'
                : hasBio
                  ? 'On'
                  : hasPin || vaultMeta?.mode === 'passphrase'
                    ? 'Off'
                    : 'Set a PIN first'}
            </p>
          </div>
        </div>
        {biometricSupport !== 'none' && (
          <button
            type="button"
            disabled={busy || (!hasBio && !hasPin && vaultMeta?.mode !== 'passphrase')}
            className={hasBio ? btn : 'min-h-[38px] px-4 rounded-full hub-bg-accent text-xs font-medium disabled:opacity-50'}
            onClick={() => void run(hasBio ? disableBiometricUnlock : enableBiometricUnlock)}
          >
            {hasBio ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>

      {/* Recovery code */}
      <div className={row}>
        <div className="flex items-center gap-2.5 min-w-0">
          <LifeBuoy className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Recovery code</p>
            <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
              {vaultMeta?.mode === 'device' ? 'Opens your vault if you forget the PIN' : 'Backup way in'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() =>
            recovery
              ? setRecovery('')
              : void run(async () => setRecovery(await getRecoveryCode()))
          }
        >
          {recovery ? 'Hide' : 'Show'}
        </button>
      </div>
      {recovery && (
        <div className="pb-3 space-y-2">
          <p className="font-mono text-[13px] leading-relaxed tracking-wide break-all rounded-xl bg-[#F1F3F4] dark:bg-[#282A2C] px-3 py-2 select-all">
            {recovery}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${btn} inline-flex items-center gap-1.5`}
              onClick={() =>
                void copyWithAutoClear(recovery, preferences.clipboardClearSeconds ?? 30).then(
                  (ok) => setCopied(ok)
                )
              }
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
              Store offline. Anyone with it can open this vault.
            </span>
          </div>
        </div>
      )}

      {/* Privacy screen */}
      <div className={row}>
        <div className="flex items-center gap-2.5 min-w-0">
          <EyeOff className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Privacy screen</p>
            <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
              {isNative() ? 'Hide in Recents · block screenshots' : 'Blur when you switch away'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(preferences.blurOnSwitch)}
          onClick={() => void updatePreferences({ blurOnSwitch: !preferences.blurOnSwitch })}
          className={preferences.blurOnSwitch ? 'min-h-[38px] px-4 rounded-full hub-bg-accent text-xs font-medium' : btn}
        >
          {preferences.blurOnSwitch ? 'On' : 'Off'}
        </button>
      </div>

      {/* Clipboard */}
      <div className={row}>
        <div className="flex items-center gap-2.5 min-w-0">
          <ClipboardX className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
          <p className="text-sm font-medium">Clear copied secrets</p>
        </div>
        <select
          aria-label="Clear clipboard after"
          value={preferences.clipboardClearSeconds ?? 30}
          onChange={(e) => void updatePreferences({ clipboardClearSeconds: Number(e.target.value) })}
          className="min-h-[38px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-3 text-xs"
        >
          <option value={0}>Never</option>
          <option value={15}>After 15 s</option>
          <option value={30}>After 30 s</option>
          <option value={60}>After 1 min</option>
        </select>
      </div>

      {/* Activity log */}
      <div className={row}>
        <div className="flex items-center gap-2.5 min-w-0">
          <History className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
          <p className="text-sm font-medium">Security activity</p>
        </div>
        <button type="button" className={btn} onClick={() => setShowLog((v) => !v)}>
          {showLog ? 'Hide' : 'View'}
        </button>
      </div>
      {showLog && (
        <ul className="pb-3 space-y-1 max-h-56 overflow-y-auto">
          {readSecurityLog().length === 0 && (
            <li className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">No events yet.</li>
          )}
          {readSecurityLog()
            .slice(0, 25)
            .map((ev) => (
              <li key={`${ev.t}-${ev.e}`} className="flex items-center justify-between gap-3 text-xs">
                <span className={/wrong|cooldown/.test(ev.e) ? 'text-[#C5221F] dark:text-[#F28B82]' : ''}>
                  {EVENT_LABELS[ev.e] ?? ev.e}
                </span>
                <span className="font-mono text-[11px] text-[#5F6368] dark:text-[#9AA0A6] shrink-0">
                  {new Date(ev.t).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
        </ul>
      )}

      {/* Lock now / remove lock */}
      {canLock && (
        <div className={row}>
          <button type="button" className={`${btn} inline-flex items-center gap-1.5`} onClick={lockVault}>
            <Lock className="w-3.5 h-3.5" />
            Lock now
          </button>
          {hasPin &&
            (!confirmRemove ? (
              <button
                type="button"
                className="min-h-[38px] px-3 text-xs font-medium text-[#C5221F] dark:text-[#F28B82] hover:underline"
                onClick={() => setConfirmRemove(true)}
              >
                Remove PIN
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-[38px] px-3 text-xs font-semibold text-[#C5221F] dark:text-[#F28B82]"
                  onClick={() =>
                    void run(async () => {
                      await removeVaultLock();
                      setConfirmRemove(false);
                    })
                  }
                >
                  {vaultMeta?.mode === 'device' ? 'Remove (no lock)' : 'Remove'}
                </button>
                <button type="button" className="min-h-[38px] px-2 text-xs text-[#5F6368]" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </span>
            ))}
        </div>
      )}
    </section>
  );
};

/** One-time sheet after PIN registration offering fingerprint unlock. */
export const BiometricOffer: React.FC = () => {
  const { vaultMeta, biometricSupport, enableBiometricUnlock, phase } = useVault();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('mmv_bio_offer_done') === '1'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const show =
    phase === 'unlocked' &&
    !dismissed &&
    biometricSupport !== 'none' &&
    Boolean(vaultMeta?.quickUnlock?.pin) &&
    !vaultMeta?.quickUnlock?.bio;
  if (!show) return null;

  const close = () => {
    localStorage.setItem('mmv_bio_offer_done', '1');
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Enable fingerprint unlock"
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1F20] p-6 pb-safe text-center space-y-4"
      >
        <Fingerprint className="w-12 h-12 mx-auto hub-text-accent" />
        <h2 className="text-lg font-semibold">Unlock with fingerprint?</h2>
        {error && <p className="text-xs text-[#C5221F] dark:text-[#F28B82]">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={close} className="flex-1 min-h-[44px] rounded-full text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await enableBiometricUnlock();
                close();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not enable fingerprint.');
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 min-h-[44px] rounded-full hub-bg-accent text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Waiting…' : 'Turn on'}
          </button>
        </div>
      </div>
    </div>
  );
};
