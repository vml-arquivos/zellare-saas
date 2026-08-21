import { useEffect, useState } from 'react';
import { Download, Info } from 'lucide-react';
import {
  evaluatePwaEligibility,
  readPwaEnvironment,
  requestPwaInstall,
  subscribeInstallAvailability,
} from '../../lib/pwaEligibility';

export default function PwaInstallAction() {
  const [eligibility] = useState(() => evaluatePwaEligibility(readPwaEnvironment()));
  const [installAvailable, setInstallAvailable] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!eligibility.eligible) return undefined;
    return subscribeInstallAvailability(setInstallAvailable);
  }, [eligibility.eligible]);

  if (!eligibility.eligible || eligibility.installed) return null;
  if (!eligibility.ios && !installAvailable) return null;

  const handleClick = async () => {
    if (eligibility.ios) {
      setIosHelpOpen((open) => !open);
      return;
    }
    setInstalling(true);
    await requestPwaInstall();
    setInstalling(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        title={eligibility.ios ? 'Como instalar o Zelare' : 'Instalar o Zelare'}
        aria-expanded={eligibility.ios ? iosHelpOpen : undefined}
        style={{
          width: 38, height: 38, borderRadius: 11,
          border: '0.5px solid var(--border-default)',
          background: 'var(--surface-subtle)', cursor: installing ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-tertiary)', opacity: installing ? 0.6 : 1,
        }}
      >
        {eligibility.ios ? <Info size={16} /> : <Download size={16} />}
      </button>
      {eligibility.ios && iosHelpOpen && (
        <div
          role="status"
          style={{
            position: 'absolute', right: 0, top: 44, zIndex: 60,
            width: 240, padding: 12, borderRadius: 12,
            background: 'var(--surface-modal)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)',
            fontSize: 12, lineHeight: 1.45,
          }}
        >
          No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
        </div>
      )}
    </div>
  );
}
