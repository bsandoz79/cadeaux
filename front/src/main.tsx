import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FournisseurDonnees } from './donnees/FournisseurDonnees';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FournisseurDonnees>
      <App />
    </FournisseurDonnees>
  </StrictMode>,
);
