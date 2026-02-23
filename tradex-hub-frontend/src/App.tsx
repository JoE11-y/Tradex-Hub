import { Routes, Route, Navigate } from 'react-router-dom';
import { TradexGame } from './games/tradex/TradexGame';

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<TradexGame onBack={() => {}} />} />
    </Routes>
  );
}
