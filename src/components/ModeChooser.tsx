import React from 'react';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { t } from '../lib/i18n';

/** One-time choice after unlocking: Lite (simple) or Full interface. */
export const ModeChooser: React.FC<{ onChoose: (lite: boolean) => void }> = ({ onChoose }) => {
  const option = (lite: boolean) => {
    const Icon = lite ? Sparkles : LayoutGrid;
    return (
      <button
        type="button"
        onClick={() => onChoose(lite)}
        className="w-full rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] p-4 text-left flex gap-3 items-start hover:border-[var(--hub-accent)] transition-colors"
      >
        <span className="w-10 h-10 rounded-full hub-bg-soft flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <span>
          <span className="block text-base font-semibold">{t(lite ? 'lite.chooseLite' : 'lite.chooseFull')}</span>
          <span className="block text-sm text-[#5F6368] dark:text-[#9AA0A6]">
            {t(lite ? 'lite.chooseLiteDesc' : 'lite.chooseFullDesc')}
          </span>
        </span>
      </button>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('lite.chooseTitle')}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1F20] p-6 pb-safe space-y-4"
      >
        <h2 className="text-lg font-semibold">{t('lite.chooseTitle')}</h2>
        <div className="space-y-2.5">
          {option(true)}
          {option(false)}
        </div>
        <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">{t('lite.changeLater')}</p>
      </div>
    </div>
  );
};
