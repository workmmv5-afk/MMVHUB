import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { LogoMark } from './Logo';
import { PIN_MAX, PIN_MIN, isNativeApp } from '../lib/quickUnlock';
import { haptic } from '../lib/haptics';

type Step = 'pin' | 'confirm' | 'passphrase' | 'recovery';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'] as const;

const PinDots: React.FC<{ value: string; shake: boolean; total?: number }> = ({
  value,
  shake,
  total,
}) => (
  <div
    aria-hidden="true"
    className={`flex items-center justify-center gap-3 h-6 ${shake ? 'hub-shake' : ''}`}
  >
    {Array.from({
      length:
        total ??
        Math.max(PIN_MIN, Math.min(PIN_MAX, value.length + (value.length < PIN_MAX ? 1 : 0))),
    }).map(
      (_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full transition-all ${
            i < value.length
              ? 'bg-[var(--hub-accent)] scale-110'
              : 'border-2 border-[#C4C7C5] dark:border-[#5F6368]'
          }`}
        />
      )
    )}
  </div>
);

export const VaultGate: React.FC = () => {
  const {
    phase,
    vaultMeta,
    user,
    isOnline,
    biometricSupport,
    setupPinVault,
    setupPassphraseVault,
    unlockWithPin,
    unlockWithBiometric,
    unlockWithPassphrase,
    unlockWithRecoveryCode,
    signInWithGoogle,
    signOutGoogle,
    wipeLocalVault,
  } = useVault();

  const isSetup = phase === 'needs-setup';
  const hasPin = Boolean(vaultMeta?.quickUnlock?.pin);
  const hasBio = Boolean(vaultMeta?.quickUnlock?.bio) && biometricSupport !== 'none';
  const hasPassphrase = vaultMeta?.mode === 'passphrase';

  const [step, setStep] = useState<Step>(() =>
    isSetup || hasPin ? 'pin' : 'passphrase'
  );
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(
    vaultMeta?.quickUnlock?.lockedUntil ?? null
  );
  const [now, setNow] = useState(Date.now());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const bioTried = useRef(false);

  // Keep step sensible when vault meta loads/changes (e.g. Google restore)
  useEffect(() => {
    if (!isSetup) setStep(hasPin ? 'pin' : 'passphrase');
  }, [isSetup, hasPin]);

  // Cooldown ticker
  useEffect(() => {
    if (!lockedUntil || lockedUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) setLockedUntil(null);
    }, 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const fail = (msg: string) => {
    haptic('warning');
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  };

  const tryBiometric = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      await unlockWithBiometric();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fingerprint failed. Use your PIN.');
    } finally {
      setBusy(false);
    }
  }, [unlockWithBiometric]);

  // Auto-prompt fingerprint once on the unlock screen
  useEffect(() => {
    if (!isSetup && hasBio && !bioTried.current) {
      bioTried.current = true;
      void tryBiometric();
    }
  }, [isSetup, hasBio, tryBiometric]);

  const submitPin = useCallback(
    async (value: string) => {
      if (value.length < PIN_MIN || busy) return;
      setError('');
      if (isSetup) {
        if (step === 'pin') {
          setFirstPin(value);
          setPin('');
          setStep('confirm');
          return;
        }
        if (value !== firstPin) {
          setPin('');
          setFirstPin('');
          setStep('pin');
          fail('PINs didn’t match. Try again.');
          return;
        }
        setBusy(true);
        try {
          await setupPinVault(value);
        } catch (err) {
          fail(err instanceof Error ? err.message : 'Could not create vault.');
        } finally {
          setBusy(false);
        }
        return;
      }
      setBusy(true);
      try {
        const res = await unlockWithPin(value);
        if (!res.ok) {
          setPin('');
          if (res.lockedUntil && res.lockedUntil > Date.now()) {
            setLockedUntil(res.lockedUntil);
            fail('Too many attempts.');
          } else {
            fail(
              res.error ??
                (res.attemptsLeft !== undefined && res.attemptsLeft <= 2
                  ? `Wrong PIN · ${res.attemptsLeft} ${res.attemptsLeft === 1 ? 'try' : 'tries'} left`
                  : 'Wrong PIN')
            );
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, isSetup, step, firstPin, setupPinVault, unlockWithPin]
  );

  const press = useCallback(
    (k: (typeof KEYS)[number]) => {
      if (busy) return;
      if (k === 'del') {
        setPin((p) => p.slice(0, -1));
        return;
      }
      if (k === 'bio') return;
      haptic('tick');
      setPin((p) => {
        if (p.length >= PIN_MAX) return p;
        const next = p + k;
        // Unlock auto-submits at the stored PIN length; setup at 6 digits
        const storedLen = vaultMeta?.quickUnlock?.pin?.length;
        if ((!isSetup && storedLen && next.length === storedLen) || next.length === PIN_MAX) {
          window.setTimeout(() => void submitPin(next), 60);
        }
        return next;
      });
    },
    [busy, isSetup, submitPin, vaultMeta?.quickUnlock?.pin?.length]
  );

  // Physical keyboard support on the PIN pad
  useEffect(() => {
    if (step === 'passphrase' || step === 'recovery') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') void submitPin(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, press, submitPin, pin]);

  const submitPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSetup) {
      if (passphrase.length < 8) return fail('Use at least 8 characters.');
      if (passphrase !== confirmPassphrase) return fail('Passphrases don’t match.');
    } else if (!passphrase) {
      return fail('Enter your passphrase.');
    }
    setBusy(true);
    try {
      if (isSetup) await setupPassphraseVault(passphrase);
      else if (!(await unlockWithPassphrase(passphrase))) fail('Wrong passphrase.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const googleRestore = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#131314]">
        <LogoMark size={56} className="animate-pulse" />
      </div>
    );
  }

  const cooling = lockedUntil !== null && lockedUntil > now;
  const coolSecs = cooling ? Math.ceil((lockedUntil! - now) / 1000) : 0;

  const title = isSetup
    ? step === 'confirm'
      ? 'Confirm PIN'
      : step === 'passphrase'
        ? 'Create passphrase'
        : 'Create a PIN'
    : step === 'passphrase'
      ? 'Enter passphrase'
      : step === 'recovery'
        ? 'Recovery code'
        : 'Enter PIN';

  const linkCls =
    'text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:text-[var(--hub-accent)] min-h-[36px] px-2';

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] dark:bg-[#131314] text-[#202124] dark:text-[#E8EAED] flex flex-col items-center justify-center px-6 py-8 pt-safe pb-safe">
      <div className="w-full max-w-[320px] flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <LogoMark size={64} />
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {user && !isSetup && (
            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] -mt-2 truncate max-w-full">
              {user.email}
            </p>
          )}
        </div>

        {step === 'recovery' ? (
          <form
            className="w-full space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setBusy(true);
              try {
                if (!(await unlockWithRecoveryCode(recoveryCode))) {
                  fail('That code doesn’t match this vault.');
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <textarea
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              rows={3}
              autoFocus
              spellCheck={false}
              autoCapitalize="characters"
              placeholder="XXXX-XXXX-XXXX-…"
              aria-label="Recovery code"
              className="w-full rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-4 py-3 font-mono text-sm tracking-wide focus:outline-none focus:border-[var(--hub-accent)] resize-none"
            />
            {error && (
              <p role="alert" className="text-xs text-center text-[#C5221F] dark:text-[#F28B82]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || recoveryCode.trim().length < 20}
              className="w-full min-h-[48px] rounded-full hub-bg-accent text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Unlock'}
            </button>
          </form>
        ) : step !== 'passphrase' ? (
          <>
            <PinDots
              value={pin}
              shake={shake}
              total={isSetup ? undefined : vaultMeta?.quickUnlock?.pin?.length}
            />
            <p
              role="alert"
              aria-live="polite"
              className={`text-xs min-h-[16px] text-center ${
                error || cooling ? 'text-[#C5221F] dark:text-[#F28B82]' : 'text-[#5F6368] dark:text-[#9AA0A6]'
              }`}
            >
              {cooling
                ? `Try again in ${coolSecs}s`
                : error ||
                  (isSetup
                    ? step === 'confirm'
                      ? 'Enter it once more'
                      : `${PIN_MIN}–${PIN_MAX} digits`
                    : busy
                      ? 'Unlocking…'
                      : '')}
            </p>

            <div className="grid grid-cols-3 gap-3 w-full">
              {KEYS.map((k) => {
                if (k === 'bio') {
                  return hasBio && !isSetup ? (
                    <button
                      key={k}
                      type="button"
                      onClick={() => void tryBiometric()}
                      disabled={busy}
                      aria-label="Unlock with fingerprint"
                      className="h-16 rounded-full flex items-center justify-center hub-text-accent hover:bg-[#E8EAED] dark:hover:bg-[#282A2C] disabled:opacity-40"
                    >
                      <Fingerprint className="w-7 h-7" />
                    </button>
                  ) : isSetup && step === 'pin' && pin.length >= PIN_MIN && pin.length < PIN_MAX ? (
                    <button
                      key={k}
                      type="button"
                      onClick={() => void submitPin(pin)}
                      className="h-16 rounded-full text-sm font-semibold hub-text-accent hover:bg-[#E8EAED] dark:hover:bg-[#282A2C]"
                    >
                      Next
                    </button>
                  ) : (
                    <span key={k} />
                  );
                }
                if (k === 'del') {
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => press('del')}
                      disabled={!pin || busy}
                      aria-label="Delete digit"
                      className="h-16 rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#E8EAED] dark:hover:bg-[#282A2C] disabled:opacity-30"
                    >
                      <Delete className="w-6 h-6" />
                    </button>
                  );
                }
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    disabled={busy || cooling}
                    className="h-16 rounded-full bg-white dark:bg-[#1E1F20] border border-[#E8EAED] dark:border-[#282A2C] text-2xl font-medium tabular-nums hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] active:scale-95 transition disabled:opacity-40"
                  >
                    {k}
                  </button>
                );
              })}
            </div>

          </>
        ) : (
          <form onSubmit={submitPassphrase} className="w-full space-y-3">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                autoFocus
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                className="w-full min-h-[48px] rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-4 pr-12 text-sm focus:outline-none focus:border-[var(--hub-accent)]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5F6368]"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isSetup && (
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm passphrase"
                autoComplete="new-password"
                className="w-full min-h-[48px] rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-4 text-sm focus:outline-none focus:border-[var(--hub-accent)]"
              />
            )}
            {error && (
              <p role="alert" className="text-xs text-center text-[#C5221F] dark:text-[#F28B82]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] rounded-full hub-bg-accent text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Working…' : isSetup ? 'Create vault' : 'Unlock'}
            </button>
            {isSetup && (
              <p className="text-[11px] text-center text-[#5F6368] dark:text-[#9AA0A6]">
                Use this on all your devices to sync.
              </p>
            )}
          </form>
        )}

        {/* Secondary actions */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 -mb-2">
          {isSetup ? (
            <button
              type="button"
              className={linkCls}
              onClick={() => {
                setError('');
                setPin('');
                setStep(step === 'passphrase' ? 'pin' : 'passphrase');
              }}
            >
              {step === 'passphrase' ? 'Use a PIN instead' : 'Use a passphrase'}
            </button>
          ) : (
            hasPin &&
            hasPassphrase && (
              <button
                type="button"
                className={linkCls}
                onClick={() => {
                  setError('');
                  setStep(step === 'passphrase' ? 'pin' : 'passphrase');
                }}
              >
                {step === 'passphrase' ? 'Use PIN' : 'Use passphrase'}
              </button>
            )
          )}

          {!user && isOnline && !isNativeApp() && (
            <button type="button" className={linkCls} disabled={busy} onClick={() => void googleRestore()}>
              {isSetup ? 'Restore with Google' : 'Sign in with Google'}
            </button>
          )}
          {user && (
            <button type="button" className={linkCls} onClick={() => void signOutGoogle()}>
              Sign out
            </button>
          )}

          {!isSetup && (
            <button
              type="button"
              className={linkCls}
              onClick={() => {
                setError('');
                setStep(step === 'recovery' ? (hasPin ? 'pin' : 'passphrase') : 'recovery');
              }}
            >
              {step === 'recovery' ? 'Back' : 'Recovery code'}
            </button>
          )}

          {!isSetup &&
            (!confirmWipe ? (
              <button type="button" className={linkCls} onClick={() => setConfirmWipe(true)}>
                Forgot?
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="text-xs font-semibold text-[#C5221F] dark:text-[#F28B82] min-h-[36px] px-2"
                  onClick={() => {
                    void wipeLocalVault();
                    setConfirmWipe(false);
                    setPin('');
                  }}
                >
                  Erase this device
                </button>
                <button type="button" className={linkCls} onClick={() => setConfirmWipe(false)}>
                  Cancel
                </button>
              </span>
            ))}
        </div>
        {confirmWipe && (
          <p className="text-[11px] text-center text-[#5F6368] dark:text-[#9AA0A6] -mt-3">
            Deletes local data. Synced data can be restored with Google + passphrase.
          </p>
        )}
      </div>
    </div>
  );
};
