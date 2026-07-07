import React from 'react';
import './App.css';
import MainLayout from './components/Layout/MainLayout';
import type { Home2SectionId } from './home/home2Tasks';

const HOME2_SECTION_IDS: Home2SectionId[] = ["competitor-intelligence", "ad-performance", "new-concepts"];

const getHome2SectionId = (value: string | null): Home2SectionId | undefined =>
  HOME2_SECTION_IDS.includes(value as Home2SectionId) ? (value as Home2SectionId) : undefined;

function App() {
  if (window.location.pathname === '/onboarding') {
    return (
      <div className="App">
        <MainLayout onboardingMode />
      </div>
    );
  }

  const params = new URLSearchParams(window.location.search);
  const initialRayaView = params.get('view') === 'home3' ? 'home3' : undefined;
  const initialHome3SectionId = getHome2SectionId(params.get('section'));
  const highlightedHome3SectionId = getHome2SectionId(params.get('highlight'));
  const highlightHome3SectionId =
    params.get('onboarding') === 'complete'
      ? highlightedHome3SectionId ?? "ad-performance"
      : highlightedHome3SectionId;

  return (
    <div className="App">
      <MainLayout
        initialRayaView={initialRayaView}
        initialHome3SectionId={initialHome3SectionId}
        highlightHome3SectionId={highlightHome3SectionId}
      />
    </div>
  );
}

export default App;
