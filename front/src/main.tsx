import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FournisseurDonnees } from './donnees/FournisseurDonnees';
import { ecouterInstallation } from './installation';
import './styles/base.css';

ecouterInstallation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FournisseurDonnees>
      <App />
    </FournisseurDonnees>
  </StrictMode>,
);
