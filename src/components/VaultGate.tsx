import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { PWAInstallButton } from './PWAInstallButton';

export const VaultGate: React.FC = () => {
  const {
    phase,
    user,
    isOnline,
    setupPassphraseVault,
    setupDeviceKeyVault,
    unlockWithPassphrase,
    signInWithGoogle,
    signOutGoogle,
    wipeLocalVault,
  } = useVault();

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const isSetup = phase === 'needs-setup';

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passphrase.length < 6) {
      setError('Use at least 6 characters for your vault passphrase.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      await setupPassphraseVault(passphrase);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to initialize vault.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!passphrase) {
      setError('Enter your vault passphrase.');
      return;
    }
    setBusy(true);
    try {
      const ok = await unlockWithPassphrase(passphrase);
      if (!ok) {
        setError('Incorrect passphrase. Decryption verification failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock vault.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSyncSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#131314] flex items-center justify-center p-6">
        <div className="text-sm text-[#444746] dark:text-[#C4C7C5]">
          Initializing encrypted storage...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#131314] text-[#202124] dark:text-[#E8EAED] flex flex-col justify-between p-5 sm:p-8">
      <header className="w-full max-w-md mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1E1F20] border border-[#E1E3E1] dark:border-[#444746] grid grid-cols-2 gap-0.5 p-1.5">
            <span className="rounded-[2px] bg-[#4285F4]" />
            <span className="rounded-[2px] bg-[#EA4335]" />
            <span className="rounded-[2px] bg-[#FBBC05]" />
            <span className="rounded-[2px] bg-[#34A853]" />
          </div>
          <span className="text-lg font-semibold tracking-tight whitespace-nowrap">
            MMV-HUB
          </span>
        </div>
        <PWAInstallButton compact />
      </header>

      <main className="w-full max-w-md mx-auto my-8">
        <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium hub-text-accent">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>End-to-End Encrypted Personal Workspace</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {isSetup ? 'Create your private vault' : 'Welcome back'}
            </h1>
            <p className="text-sm text-[#444746] dark:text-[#C4C7C5] leading-relaxed">
              {isSetup
                ? 'Encrypt your purchases, habits, and tasks locally with AES-256-GCM before syncing across devices.'
                : user
                  ? `Signed in as ${user.email}. Enter your passphrase to unlock your synced hub.`
                  : 'Enter your passphrase to unlock your offline personal hub.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-[#F2B8B5] dark:border-[#8C1D18] bg-[#FCE8E6] dark:bg-[#601410]/50 px-4 py-3 text-xs text-[#B3261E] dark:text-[#F2B8B5]"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={isSetup ? handleSetupSubmit : handleUnlockSubmit}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="vault-passphrase"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                Vault Passphrase
              </label>
              <div className="relative">
                <input
                  id="vault-passphrase"
                  type={showPassword ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={
                    isSetup ? 'At least 6 characters' : 'Enter your passphrase'
                  }
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  className="w-full min-h-[48px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-4 pr-12 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#0B57D0] dark:focus:ring-[#A8C7FA]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {isSetup && (
              <div className="space-y-1.5">
                <label
                  htmlFor="vault-passphrase-confirm"
                  className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
                >
                  Confirm Passphrase
                </label>
                <input
                  id="vault-passphrase-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter passphrase"
                  autoComplete="new-password"
                  className="w-full min-h-[48px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-4 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#0B57D0] dark:focus:ring-[#A8C7FA]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] rounded-full hub-bg-accent text-sm font-medium flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              <Lock className="w-4 h-4" />
              <span>
                {busy
                  ? 'Deriving key...'
                  : isSetup
                    ? 'Create Encrypted Vault'
                    : 'Unlock Vault'}
              </span>
            </button>
          </form>

          {isSetup && (
            <div className="pt-2 border-t border-[#E1E3E1] dark:border-[#444746] space-y-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void setupDeviceKeyVault()}
                className="w-full min-h-[44px] rounded-full border border-[#747775] dark:border-[#8E918F] hub-text-accent text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                <span>Quick Start with Device Key</span>
              </button>
              <p className="text-xs text-[#444746] dark:text-[#C4C7C5] text-center">
                Creates a local 256-bit key on this device. Set a passphrase anytime in Settings for cross-device sync.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-[#E1E3E1] dark:border-[#444746] space-y-3">
            {!user ? (
              <button
                type="button"
                disabled={busy || !isOnline}
                onClick={() => void handleGoogleSyncSignIn()}
                className="w-full min-h-[44px] rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] text-[#1F1F1F] dark:text-[#E3E3E3] text-sm font-medium hover:bg-[#DCE3EF] dark:hover:bg-[#333537] disabled:opacity-50 transition-colors"
              >
                {isOnline
                  ? isSetup
                    ? 'Restore Synced Vault with Google'
                    : 'Sign in with Google'
                  : 'Offline Mode — Connect to Sync'}
              </button>
            ) : (
              <div className="flex items-center justify-between text-xs text-[#444746] dark:text-[#C4C7C5]">
                <span className="truncate">{user.email}</span>
                <button
                  type="button"
                  onClick={() => void signOutGoogle()}
                  className="font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:underline ml-3 shrink-0 min-h-[36px]"
                >
                  Sign out
                </button>
              </div>
            )}

            {!isSetup && (
              <div className="text-center">
                {!confirmWipe ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="text-xs text-[#444746] dark:text-[#C4C7C5] hover:text-[#0B57D0] dark:hover:text-[#A8C7FA] underline"
                  >
                    Forgot passphrase? Reset local vault
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void wipeLocalVault();
                        setConfirmWipe(false);
                        setPassphrase('');
                      }}
                      className="text-xs font-medium text-[#B3261E] dark:text-[#F2B8B5] hover:underline"
                    >
                      Confirm local wipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(false)}
                      className="text-xs text-[#444746] dark:text-[#C4C7C5] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-md mx-auto text-center text-xs text-[#444746] dark:text-[#C4C7C5] pb-2">
        MMV-HUB · Personal Encrypted Storage · Offline-first PWA
      </footer>
    </div>
  );
};
